import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  InitDraftInvoiceInput,
  AddInvoiceItemInput,
  UpdateInvoiceItemInput,
  RemoveInvoiceItemInput,
  GetDraftInvoiceInput,
  FinalizeDraftInvoiceInput,
  CancelDraftInvoiceInput,
} from '../tools/conversational-orders.js';

interface DraftItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  price: number;
  gst_rate: number;
  total: number;
}

interface DraftInvoice {
  id: string;
  user_id: string;
  session_id: string;
  customer_id?: string;
  customer_name?: string;
  items: DraftItem[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export class ConversationalOrdersService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Initialize a new draft invoice session
   */
  async initDraftInvoice(input: InitDraftInvoiceInput): Promise<DraftInvoice> {
    const sessionId = input.session_id || `session-${Date.now()}-${uuidv4().substring(0, 8)}`;

    const { data, error } = await this.supabase
      .from('invoice_drafts')
      .insert({
        user_id: input.user_id,
        session_id: sessionId,
        customer_id: input.customer_id,
        customer_name: input.customer_name,
        items: [],
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create draft invoice: ${error.message}`);

    return data as DraftInvoice;
  }

  /**
   * Fuzzy search for a product by name
   */
  private async fuzzySearchProduct(userId: string, productName: string) {
    // First try exact match
    const { data: exactMatch } = await this.supabase
      .from('products')
      .select('id, name, hindi_name, price')
      .eq('user_id', userId)
      .or(`name.ilike.%${productName}%,hindi_name.ilike.%${productName}%`)
      .limit(1)
      .single();

    if (exactMatch) return exactMatch;

    // Fall back to fuzzy search function
    const { data: fuzzyMatches, error } = await this.supabase
      .rpc('fuzzy_search_products', {
        p_user_id: userId,
        p_query: productName,
        p_limit: 1,
      });

    if (error || !fuzzyMatches || fuzzyMatches.length === 0) {
      throw new Error(`Product "${productName}" not found in inventory`);
    }

    return fuzzyMatches[0];
  }

  /**
   * Add or update an item in the draft invoice
   */
  async addInvoiceItem(input: AddInvoiceItemInput): Promise<DraftInvoice> {
    // Get the draft
    const { data: draft, error: fetchError } = await this.supabase
      .from('invoice_drafts')
      .select('*')
      .eq('session_id', input.session_id)
      .eq('user_id', input.user_id)
      .single();

    if (fetchError || !draft) {
      throw new Error('Draft invoice not found. Please start a new order.');
    }

    let productId = input.product_id;
    let unitPrice = input.unit_price;

    // If product_id not provided, search for it
    if (!productId) {
      const product = await this.fuzzySearchProduct(input.user_id, input.product_name);
      productId = product.id;
      if (!unitPrice) {
        unitPrice = product.price;
      }
    }

    // If still no price, fetch product price
    if (!unitPrice) {
      const { data: product } = await this.supabase
        .from('products')
        .select('price')
        .eq('id', productId)
        .single();

      unitPrice = product?.price || 0;
    }

    const gstRate = input.gst_rate || 18;
    const finalUnitPrice = unitPrice || 0; // Ensure it's never undefined
    const total = finalUnitPrice * input.quantity;

    const newItem: DraftItem = {
      product_id: productId,
      product_name: input.product_name,
      quantity: input.quantity,
      price: finalUnitPrice,
      gst_rate: gstRate,
      total,
    };

    // Check if item already exists in draft
    const items = (draft.items as DraftItem[]) || [];
    const existingIndex = items.findIndex(
      (item) => item.product_id === productId || item.product_name.toLowerCase() === input.product_name.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing item (increase quantity)
      items[existingIndex].quantity += input.quantity;
      items[existingIndex].total = items[existingIndex].price * items[existingIndex].quantity;
    } else {
      // Add new item
      items.push(newItem);
    }

    // Update draft
    const { data: updated, error: updateError } = await this.supabase
      .from('invoice_drafts')
      .update({ items, updated_at: new Date().toISOString() })
      .eq('id', draft.id)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update draft: ${updateError.message}`);

    return updated as DraftInvoice;
  }

  /**
   * Update an existing item in the draft
   */
  async updateInvoiceItem(input: UpdateInvoiceItemInput): Promise<DraftInvoice> {
    const { data: draft, error: fetchError } = await this.supabase
      .from('invoice_drafts')
      .select('*')
      .eq('session_id', input.session_id)
      .eq('user_id', input.user_id)
      .single();

    if (fetchError || !draft) {
      throw new Error('Draft invoice not found');
    }

    const items = (draft.items as DraftItem[]) || [];
    const itemIndex = items.findIndex(
      (item) => item.product_name.toLowerCase() === input.product_name.toLowerCase()
    );

    if (itemIndex === -1) {
      throw new Error(`Item "${input.product_name}" not found in draft`);
    }

    // Update item
    if (input.quantity !== undefined) {
      items[itemIndex].quantity = input.quantity;
    }
    if (input.unit_price !== undefined) {
      items[itemIndex].price = input.unit_price;
    }

    items[itemIndex].total = items[itemIndex].price * items[itemIndex].quantity;

    const { data: updated, error: updateError } = await this.supabase
      .from('invoice_drafts')
      .update({ items, updated_at: new Date().toISOString() })
      .eq('id', draft.id)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update draft: ${updateError.message}`);

    return updated as DraftInvoice;
  }

  /**
   * Remove an item from the draft
   */
  async removeInvoiceItem(input: RemoveInvoiceItemInput): Promise<DraftInvoice> {
    const { data: draft, error: fetchError } = await this.supabase
      .from('invoice_drafts')
      .select('*')
      .eq('session_id', input.session_id)
      .eq('user_id', input.user_id)
      .single();

    if (fetchError || !draft) {
      throw new Error('Draft invoice not found');
    }

    const items = (draft.items as DraftItem[]) || [];
    const filteredItems = items.filter(
      (item) => item.product_name.toLowerCase() !== input.product_name.toLowerCase()
    );

    if (filteredItems.length === items.length) {
      throw new Error(`Item "${input.product_name}" not found in draft`);
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('invoice_drafts')
      .update({ items: filteredItems, updated_at: new Date().toISOString() })
      .eq('id', draft.id)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update draft: ${updateError.message}`);

    return updated as DraftInvoice;
  }

  /**
   * Get the current state of the draft invoice
   */
  async getDraftInvoice(input: GetDraftInvoiceInput): Promise<DraftInvoice> {
    const { data: draft, error } = await this.supabase
      .from('invoice_drafts')
      .select('*')
      .eq('session_id', input.session_id)
      .eq('user_id', input.user_id)
      .single();

    if (error || !draft) {
      throw new Error('Draft invoice not found');
    }

    return draft as DraftInvoice;
  }

  /**
   * Finalize the draft and create an actual invoice
   */
  async finalizeDraftInvoice(input: FinalizeDraftInvoiceInput) {
    const { data: draft, error: fetchError } = await this.supabase
      .from('invoice_drafts')
      .select('*')
      .eq('session_id', input.session_id)
      .eq('user_id', input.user_id)
      .single();

    if (fetchError || !draft) {
      throw new Error('Draft invoice not found');
    }

    const items = draft.items as DraftItem[];

    if (!items || items.length === 0) {
      throw new Error('Cannot create invoice: no items in draft');
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const gstAmount = items.reduce((sum, item) => sum + (item.total * item.gst_rate) / 100, 0);
    const totalAmount = subtotal + gstAmount;

    // Generate invoice number
    const { count } = await this.supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', input.user_id);

    const invoiceCount = (count || 0) + 1;
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const invoiceNumber = `INV-${year}${month}-${String(invoiceCount).padStart(4, '0')}`;

    // Create invoice
    const { data: invoice, error: invoiceError } = await this.supabase
      .from('invoices')
      .insert({
        user_id: input.user_id,
        invoice_number: invoiceNumber,
        customer_id: input.customer_id || draft.customer_id,
        customer_name: input.customer_name || draft.customer_name,
        customer_phone: input.customer_phone,
        subtotal,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        payment_method: input.payment_method || 'Cash',
        notes: input.notes || draft.notes,
        status: 'paid',
      })
      .select()
      .single();

    if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

    // Create invoice items
    const invoiceItems = items.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      cost_price: 0, // TODO: Fetch from products table
      gst_rate: item.gst_rate,
      total: item.total,
    }));

    const { error: itemsError } = await this.supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) throw new Error(`Failed to create invoice items: ${itemsError.message}`);

    // Update product stock for each item
    for (const item of items) {
      if (item.product_id) {
        const { data: product } = await this.supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single();

        if (product) {
          await this.supabase
            .from('products')
            .update({ quantity: product.quantity - item.quantity })
            .eq('id', item.product_id);
        }
      }
    }

    // Delete the draft
    await this.supabase
      .from('invoice_drafts')
      .delete()
      .eq('id', draft.id);

    return {
      invoice,
      message: `Invoice ${invoiceNumber} created successfully with ${items.length} items. Total: ₹${totalAmount.toFixed(2)}`,
    };
  }

  /**
   * Cancel and delete a draft invoice
   */
  async cancelDraftInvoice(input: CancelDraftInvoiceInput): Promise<{ message: string }> {
    const { error } = await this.supabase
      .from('invoice_drafts')
      .delete()
      .eq('session_id', input.session_id)
      .eq('user_id', input.user_id);

    if (error) throw new Error(`Failed to cancel draft: ${error.message}`);

    return { message: 'Draft invoice cancelled successfully' };
  }
}
