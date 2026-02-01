import { DatabaseService } from '../types/service.js';
import { supabase } from './supabase.js';

export class SupabaseService implements DatabaseService {
    public supabase = supabase; // Expose for other services

    // ============ INVENTORY ============
    async getProducts(userId: string, options: any = {}) {
        let query = supabase
            .from('products')
            .select('*')
            .eq('user_id', userId);

        if (options.category) query = query.eq('category', options.category);
        if (options.search) query = query.ilike('name', `%${options.search}%`);
        if (options.lowStockOnly) query = query.lt('quantity', 'low_stock_threshold');
        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async getProduct(userId: string, productId: string) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', userId)
            .eq('id', productId)
            .single();

        if (error) throw error;
        return data;
    }

    async createProduct(userId: string, productData: any) {
        const { data, error } = await supabase
            .from('products')
            .insert([{ ...productData, user_id: userId }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateStock(userId: string, productId: string, quantity: number, operation: 'add' | 'subtract' | 'set') {
        // First get current stock
        const current = await this.getProduct(userId, productId);
        let newQuantity = quantity;

        if (operation === 'add') newQuantity = current.quantity + quantity;
        if (operation === 'subtract') newQuantity = current.quantity - quantity;

        const { data, error } = await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', productId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async getInventoryAlerts(userId: string) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        return data.filter((p: any) => p.quantity <= (p.low_stock_threshold || 0));
    }

    // ============ CUSTOMERS ============
    async getCustomers(userId: string, options: any = {}) {
        let query = supabase.from('customers').select('*').eq('user_id', userId);

        if (options.search) {
            query = query.or(`name.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
        }
        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async getCustomer(userId: string, customerId: string) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .eq('id', customerId)
            .single();
        if (error) throw error;
        return data;
    }

    async createCustomer(userId: string, customerData: any) {
        const { data, error } = await supabase
            .from('customers')
            .insert([{ ...customerData, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async updateCustomerBalance(userId: string, customerId: string, amount: number, operation: 'add' | 'subtract') {
        const customer = await this.getCustomer(userId, customerId);
        let newBalance = customer.outstanding_balance || 0;

        if (operation === 'add') newBalance += amount;
        else newBalance -= amount;

        const { data, error } = await supabase
            .from('customers')
            .update({ outstanding_balance: newBalance })
            .eq('id', customerId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ============ TRANSACTIONS ============
    async getTransactions(userId: string, options: any = {}) {
        let query = supabase.from('transactions').select('*').eq('user_id', userId);

        if (options.startDate) query = query.gte('created_at', options.startDate);
        if (options.endDate) query = query.lte('created_at', options.endDate);
        if (options.paymentType) query = query.eq('payment_type', options.paymentType);
        if (options.status) query = query.eq('payment_status', options.status);
        if (options.customerId) query = query.eq('customer_id', options.customerId);
        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async createTransaction(userId: string, transactionData: any) {
        const { data, error } = await supabase
            .from('transactions')
            .insert([{ ...transactionData, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    // ============ INVOICES ============
    async getInvoices(userId: string, options: any = {}) {
        let query = supabase.from('invoices').select('*').eq('user_id', userId);

        if (options.status) query = query.eq('status', options.status);
        if (options.type) query = query.eq('invoice_type', options.type);
        if (options.customerId) query = query.eq('customer_id', options.customerId);
        if (options.startDate) query = query.gte('created_at', options.startDate);
        if (options.endDate) query = query.lte('created_at', options.endDate);
        if (options.limit) query = query.limit(options.limit);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async getInvoice(userId: string, invoiceId: string) {
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('user_id', userId)
            .eq('id', invoiceId)
            .single();
        if (error) throw error;
        return data;
    }

    async getNextInvoiceNumber(userId: string, type: string) {
        const { count, error } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('invoice_type', type);

        if (error) throw error;
        return `${type.toUpperCase().substring(0, 3)}-${(count || 0) + 1}`;
    }

    async createInvoice(userId: string, invoiceData: any) {
        const { data, error } = await supabase
            .from('invoices')
            .insert([{ ...invoiceData, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async updateInvoiceStatus(userId: string, invoiceId: string, status: string) {
        const { data, error } = await supabase
            .from('invoices')
            .update({ status })
            .eq('id', invoiceId)
            .eq('user_id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    // ============ USER/COMMON ============
    async getUser(userId: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) return null;
        return data;
    }

    async updateUser(userId: string, startData: any) {
        const { data, error } = await supabase
            .from('users')
            .update(startData)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    // ============ ANALYTICS ============
    async getDailyReport(userId: string, date: string) {
        return {
            date,
            total_sales: 0,
            total_transactions: 0,
            total_expenses: 0,
            top_products: []
        };
    }

    async getSalesAnalytics(userId: string, period: 'week' | 'month' | 'year') {
        return {
            period,
            revenue_trend: [],
            payment_breakdown: {},
            growth: 0
        };
    }

    async getBusinessSummary(userId: string) {
        return {
            total_revenue: 0,
            total_customers: 0,
            total_products: 0,
            outstanding_payments: 0
        };
    }

    async getOutstandingPayments(userId: string) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .gt('outstanding_balance', 0);
        if (error) throw error;
        return data;
    }

    // ============ EXPENSES ============
    async getExpenses(userId: string, options: any = {}) {
        let query = supabase.from('expenses').select('*').eq('user_id', userId);
        if (options.limit) query = query.limit(options.limit);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async createExpense(userId: string, expenseData: any) {
        const { data, error } = await supabase
            .from('expenses')
            .insert([{ ...expenseData, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    // ============ SUPPLIERS ============
    async getSuppliers(userId: string, options: any = {}) {
        let query = supabase.from('suppliers').select('*').eq('user_id', userId);
        if (options.limit) query = query.limit(options.limit);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async createSupplier(userId: string, supplierData: any) {
        const { data, error } = await supabase
            .from('suppliers')
            .insert([{ ...supplierData, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    // ============ STORAGE ============
    async uploadPDF(userId: string, fileName: string, pdfBuffer: Buffer): Promise<string> {
        const bucketName = 'pdfs';
        const filePath = `${userId}/${fileName}`;

        // Ensure bucket exists (best effort, service key usually has permission)
        try {
            const { data: buckets } = await supabase.storage.listBuckets();
            if (!buckets?.find(b => b.name === bucketName)) {
                await supabase.storage.createBucket(bucketName, {
                    public: true,
                    fileSizeLimit: 5242880, // 5MB
                    allowedMimeTypes: ['application/pdf']
                });
            }
        } catch (e) {
            console.error('Bucket check/creation error:', e);
            // Continue anyway, maybe it exists but we can't list
        }

        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (error) {
            console.error('Upload error:', error);
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        return publicUrl;
    }
}
