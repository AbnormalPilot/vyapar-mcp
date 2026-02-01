export interface DatabaseService {
    // Inventory
    getProducts(userId: string, options?: any): Promise<any>;
    getProduct(userId: string, productId: string): Promise<any>;
    createProduct(userId: string, productData: any): Promise<any>;
    updateStock(userId: string, productId: string, quantity: number, operation: 'add' | 'subtract' | 'set'): Promise<any>;
    getInventoryAlerts(userId: string): Promise<any>;

    // Customers
    getCustomers(userId: string, options?: any): Promise<any>;
    getCustomer(userId: string, customerId: string): Promise<any>;
    createCustomer(userId: string, customerData: any): Promise<any>;
    updateCustomerBalance(userId: string, customerId: string, amount: number, operation: 'add' | 'subtract'): Promise<any>;

    // Transactions
    getTransactions(userId: string, options?: any): Promise<any>;
    createTransaction(userId: string, transactionData: any): Promise<any>;

    // Invoices
    getInvoices(userId: string, options?: any): Promise<any>;
    getInvoice(userId: string, invoiceId: string): Promise<any>;
    getNextInvoiceNumber(userId: string, type: string): Promise<any>;
    createInvoice(userId: string, invoiceData: any): Promise<any>;
    updateInvoiceStatus(userId: string, invoiceId: string, status: string): Promise<any>;

    // User/Common
    getUser(userId: string): Promise<any>;
    updateUser(userId: string, userData: any): Promise<any>;

    // Analytics
    getDailyReport(userId: string, date: string): Promise<any>;
    getSalesAnalytics(userId: string, period: 'week' | 'month' | 'year'): Promise<any>;
    getBusinessSummary(userId: string): Promise<any>;
    getOutstandingPayments(userId: string): Promise<any>;

    // Expenses
    getExpenses(userId: string, options?: any): Promise<any>;
    createExpense(userId: string, expenseData: any): Promise<any>;

    // Suppliers
    getSuppliers(userId: string, options?: any): Promise<any>;
    createSupplier(userId: string, supplierData: any): Promise<any>;

    // Storage
    uploadPDF(userId: string, fileName: string, pdfBuffer: Buffer): Promise<string>;
}
