// Full QInstance fixture — CRM + Inventory apps with all table/process/widget metadata

import type {
  QInstance,
  QTableMetaData,
  QProcessMetaData,
  QWidgetMetaData,
  QAppMetaData,
  QAppTreeNode,
} from '@/types'

// ─── Field helpers ────────────────────────────────────────────────────────────

function field(
  name: string,
  label: string,
  type: QTableMetaData['fields'][string]['type'],
  overrides: Partial<QTableMetaData['fields'][string]> = {}
): QTableMetaData['fields'][string] {
  return {
    name,
    label,
    type,
    isRequired: false,
    isEditable: true,
    isHeavy: false,
    isHidden: false,
    adornments: [],
    ...overrides,
  }
}

// ─── person table ─────────────────────────────────────────────────────────────

const personTable: QTableMetaData = {
  name: 'person',
  label: 'People',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'INTEGER', { isEditable: false }),
    firstName: field('firstName', 'First Name', 'STRING', { isRequired: true, maxLength: 100 }),
    lastName: field('lastName', 'Last Name', 'STRING', { isRequired: true, maxLength: 100 }),
    email: field('email', 'Email', 'STRING', {
      maxLength: 255,
      helpContents: [{ content: 'Primary email address for this contact' }],
    }),
    phone: field('phone', 'Phone', 'STRING', {
      maxLength: 30,
      helpContents: [{ content: 'Direct phone number including extension' }],
    }),
    companyId: field('companyId', 'Company', 'INTEGER', {
      possibleValueSourceName: 'company',
      helpContents: [{ content: 'The company this person is associated with' }],
    }),
    title: field('title', 'Title', 'STRING', { maxLength: 100 }),
    status: field('status', 'Status', 'STRING', {
      isRequired: true,
      possibleValueSourceName: 'personStatus',
      adornments: [{ type: 'CHIP' }],
      helpContents: [{ content: 'Current status of this contact record' }],
    }),
    createdDate: field('createdDate', 'Created Date', 'DATE', { isEditable: false }),
    modifyDate: field('modifyDate', 'Modified Date', 'DATE_TIME', { isEditable: false }),
    notes: field('notes', 'Notes', 'TEXT'),
  },
  sections: [
    {
      name: 'identity',
      label: 'Identity',
      tier: 'T1',
      iconName: 'person',
      fieldNames: ['firstName', 'lastName', 'email', 'phone', 'title'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'details',
      label: 'Details',
      tier: 'T2',
      iconName: 'info',
      fieldNames: ['companyId', 'status'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'notes',
      label: 'Notes',
      tier: 'T3',
      iconName: 'notes',
      fieldNames: ['notes'],
      isHidden: false,
      gridColumns: 1,
    },
    {
      name: 'audit',
      label: 'Record Info',
      tier: 'T3',
      iconName: 'history',
      fieldNames: ['createdDate', 'modifyDate'],
      isHidden: false,
      gridColumns: 2,
    },
  ],
  exposedJoins: [],
  capabilities: [
    'TABLE_QUERY',
    'TABLE_GET',
    'TABLE_COUNT',
    'TABLE_INSERT',
    'TABLE_UPDATE',
    'TABLE_DELETE',
  ],
  readPermission: true,
  insertPermission: true,
  editPermission: true,
  deletePermission: true,
  usesVariants: false,
  variantTableLabel: '',
}

// ─── company table ────────────────────────────────────────────────────────────

const companyTable: QTableMetaData = {
  name: 'company',
  label: 'Companies',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'INTEGER', { isEditable: false }),
    name: field('name', 'Name', 'STRING', { isRequired: true, maxLength: 200 }),
    industry: field('industry', 'Industry', 'STRING', {
      possibleValueSourceName: 'companyIndustry',
      adornments: [{ type: 'CHIP' }],
    }),
    website: field('website', 'Website', 'STRING', {
      maxLength: 255,
      adornments: [{ type: 'LINK' }],
    }),
    revenue: field('revenue', 'Annual Revenue', 'DECIMAL', {
      displayFormat: 'CURRENCY',
    }),
    employeeCount: field('employeeCount', 'Employees', 'INTEGER'),
    city: field('city', 'City', 'STRING', { maxLength: 100 }),
    state: field('state', 'State', 'STRING', { maxLength: 50 }),
    country: field('country', 'Country', 'STRING', { maxLength: 100 }),
    createDate: field('createDate', 'Created', 'DATE_TIME', { isEditable: false }),
    modifyDate: field('modifyDate', 'Modified', 'DATE_TIME', { isEditable: false }),
  },
  sections: [
    {
      name: 'info',
      label: 'Company Info',
      tier: 'T1',
      iconName: 'business',
      fieldNames: ['name', 'industry', 'website'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'metrics',
      label: 'Metrics',
      tier: 'T2',
      iconName: 'bar_chart',
      fieldNames: ['revenue', 'employeeCount'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'location',
      label: 'Location',
      tier: 'T2',
      iconName: 'location_on',
      fieldNames: ['city', 'state', 'country'],
      isHidden: false,
      gridColumns: 3,
    },
    {
      name: 'audit',
      label: 'Record Info',
      tier: 'T3',
      iconName: 'history',
      fieldNames: ['createDate', 'modifyDate'],
      isHidden: false,
      gridColumns: 2,
    },
  ],
  exposedJoins: [],
  capabilities: [
    'TABLE_QUERY',
    'TABLE_GET',
    'TABLE_COUNT',
    'TABLE_INSERT',
    'TABLE_UPDATE',
    'TABLE_DELETE',
  ],
  readPermission: true,
  insertPermission: true,
  editPermission: true,
  deletePermission: true,
  usesVariants: false,
  variantTableLabel: '',
}

// ─── order line table ─────────────────────────────────────────────────────────

const orderLineTable: QTableMetaData = {
  name: 'orderLine',
  label: 'Order Lines',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'INTEGER', { isEditable: false }),
    orderId: field('orderId', 'Order', 'INTEGER', {
      possibleValueSourceName: 'order',
    }),
    productId: field('productId', 'Product', 'INTEGER', {
      possibleValueSourceName: 'product',
    }),
    sku: field('sku', 'SKU', 'STRING', { isEditable: false, maxLength: 50 }),
    productName: field('productName', 'Product Name', 'STRING', { isEditable: false }),
    quantity: field('quantity', 'Qty', 'INTEGER', { isRequired: true }),
    unitPrice: field('unitPrice', 'Unit Price', 'DECIMAL', { displayFormat: 'CURRENCY' }),
    lineTotal: field('lineTotal', 'Line Total', 'DECIMAL', { displayFormat: 'CURRENCY', isEditable: false }),
  },
  sections: [
    {
      name: 'line',
      label: 'Line Item',
      tier: 'T1',
      iconName: 'shopping_cart',
      fieldNames: ['sku', 'productName', 'quantity', 'unitPrice', 'lineTotal'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'references',
      label: 'References',
      tier: 'T2',
      iconName: 'info',
      fieldNames: ['orderId', 'productId'],
      isHidden: false,
      gridColumns: 2,
    },
  ],
  exposedJoins: [],
  capabilities: [
    'TABLE_QUERY',
    'TABLE_GET',
    'TABLE_COUNT',
    'TABLE_INSERT',
    'TABLE_UPDATE',
    'TABLE_DELETE',
  ],
  readPermission: true,
  insertPermission: true,
  editPermission: true,
  deletePermission: true,
  usesVariants: false,
  variantTableLabel: '',
}

// ─── order table ──────────────────────────────────────────────────────────────

const orderTable: QTableMetaData = {
  name: 'order',
  label: 'Orders',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'INTEGER', { isEditable: false }),
    orderNumber: field('orderNumber', 'Order Number', 'STRING', {
      isRequired: true,
      maxLength: 50,
      isEditable: false,
    }),
    personId: field('personId', 'Contact', 'INTEGER', {
      possibleValueSourceName: 'person',
      helpContents: [{ content: 'The person who placed or is associated with this order' }],
    }),
    companyId: field('companyId', 'Company', 'INTEGER', {
      possibleValueSourceName: 'company',
      helpContents: [{ content: 'The company this order is billed to' }],
    }),
    status: field('status', 'Status', 'STRING', {
      isRequired: true,
      possibleValueSourceName: 'orderStatus',
      adornments: [{ type: 'CHIP' }],
      helpContents: [{ content: 'Current fulfillment status of this order' }],
    }),
    total: field('total', 'Total', 'DECIMAL', {
      displayFormat: 'CURRENCY',
      helpContents: [{ content: 'Sum of all line item totals' }],
    }),
    orderDate: field('orderDate', 'Order Date', 'DATE_TIME', { isEditable: false }),
    notes: field('notes', 'Notes', 'TEXT'),
    createDate: field('createDate', 'Created', 'DATE_TIME', { isEditable: false }),
    modifyDate: field('modifyDate', 'Modified', 'DATE_TIME', { isEditable: false }),
  },
  sections: [
    {
      name: 'order',
      label: 'Order',
      tier: 'T1',
      iconName: 'shopping_cart',
      fieldNames: ['orderNumber', 'status', 'orderDate', 'total'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'relations',
      label: 'Relations',
      tier: 'T1',
      iconName: 'people',
      fieldNames: ['personId', 'companyId'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'notes',
      label: 'Notes',
      tier: 'T3',
      iconName: 'notes',
      fieldNames: ['notes'],
      isHidden: false,
      gridColumns: 1,
    },
    {
      name: 'audit',
      label: 'Record Info',
      tier: 'T3',
      iconName: 'history',
      fieldNames: ['createDate', 'modifyDate'],
      isHidden: false,
      gridColumns: 2,
    },
  ],
  exposedJoins: [
    {
      label: 'Order Lines',
      isMany: true,
      joinTable: orderLineTable,
    },
  ],
  capabilities: [
    'TABLE_QUERY',
    'TABLE_GET',
    'TABLE_COUNT',
    'TABLE_INSERT',
    'TABLE_UPDATE',
    'TABLE_DELETE',
  ],
  readPermission: true,
  insertPermission: true,
  editPermission: true,
  deletePermission: true,
  usesVariants: false,
  variantTableLabel: '',
}

// ─── Cross-table exposed joins (assigned after all tables are declared) ───────

personTable.exposedJoins = [
  { label: 'Orders', isMany: true, joinTable: orderTable },
]

companyTable.exposedJoins = [
  { label: 'Orders', isMany: true, joinTable: orderTable },
  { label: 'People', isMany: true, joinTable: personTable },
]

// ─── product table ────────────────────────────────────────────────────────────

const productTable: QTableMetaData = {
  name: 'product',
  label: 'Products',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'INTEGER', { isEditable: false }),
    sku: field('sku', 'SKU', 'STRING', { isRequired: true, maxLength: 50 }),
    name: field('name', 'Name', 'STRING', { isRequired: true, maxLength: 200 }),
    category: field('category', 'Category', 'STRING', {
      possibleValueSourceName: 'productCategory',
      adornments: [{ type: 'CHIP' }],
    }),
    price: field('price', 'Price', 'DECIMAL', { displayFormat: 'CURRENCY' }),
    stockQuantity: field('stockQuantity', 'Stock Qty', 'INTEGER'),
    reorderLevel: field('reorderLevel', 'Reorder Level', 'INTEGER'),
    supplierId: field('supplierId', 'Supplier', 'INTEGER', {
      possibleValueSourceName: 'supplier',
    }),
    active: field('active', 'Active', 'BOOLEAN'),
    imageUrl: field('imageUrl', 'Image', 'BLOB', {
      isHeavy: true,
      adornments: [{ type: 'FILE_UPLOAD' }],
    }),
    createDate: field('createDate', 'Created', 'DATE_TIME', { isEditable: false }),
    modifyDate: field('modifyDate', 'Modified', 'DATE_TIME', { isEditable: false }),
  },
  sections: [
    {
      name: 'product',
      label: 'Product',
      tier: 'T1',
      iconName: 'inventory_2',
      fieldNames: ['sku', 'name', 'category', 'active'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'stock',
      label: 'Stock & Pricing',
      tier: 'T2',
      iconName: 'warehouse',
      fieldNames: ['price', 'stockQuantity', 'reorderLevel', 'supplierId'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'media',
      label: 'Media',
      tier: 'T3',
      iconName: 'image',
      fieldNames: ['imageUrl'],
      isHidden: false,
      gridColumns: 1,
    },
    {
      name: 'audit',
      label: 'Record Info',
      tier: 'T3',
      iconName: 'history',
      fieldNames: ['createDate', 'modifyDate'],
      isHidden: false,
      gridColumns: 2,
    },
  ],
  exposedJoins: [],
  capabilities: [
    'TABLE_QUERY',
    'TABLE_GET',
    'TABLE_COUNT',
    'TABLE_INSERT',
    'TABLE_UPDATE',
    'TABLE_DELETE',
  ],
  readPermission: true,
  insertPermission: true,
  editPermission: true,
  deletePermission: true,
  usesVariants: false,
  variantTableLabel: '',
}

// ─── supplier table ───────────────────────────────────────────────────────────

const supplierTable: QTableMetaData = {
  name: 'supplier',
  label: 'Suppliers',
  isHidden: false,
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'INTEGER', { isEditable: false }),
    name: field('name', 'Name', 'STRING', { isRequired: true, maxLength: 200 }),
    contactName: field('contactName', 'Contact Name', 'STRING', { maxLength: 100 }),
    email: field('email', 'Email', 'STRING', { maxLength: 255 }),
    phone: field('phone', 'Phone', 'STRING', { maxLength: 30 }),
    country: field('country', 'Country', 'STRING', { maxLength: 100 }),
    createDate: field('createDate', 'Created', 'DATE_TIME', { isEditable: false }),
    modifyDate: field('modifyDate', 'Modified', 'DATE_TIME', { isEditable: false }),
  },
  sections: [
    {
      name: 'supplier',
      label: 'Supplier',
      tier: 'T1',
      iconName: 'local_shipping',
      fieldNames: ['name', 'contactName', 'email', 'phone', 'country'],
      isHidden: false,
      gridColumns: 2,
    },
    {
      name: 'audit',
      label: 'Record Info',
      tier: 'T3',
      iconName: 'history',
      fieldNames: ['createDate', 'modifyDate'],
      isHidden: false,
      gridColumns: 2,
    },
  ],
  exposedJoins: [],
  capabilities: [
    'TABLE_QUERY',
    'TABLE_GET',
    'TABLE_COUNT',
    'TABLE_INSERT',
    'TABLE_UPDATE',
    'TABLE_DELETE',
  ],
  readPermission: true,
  insertPermission: true,
  editPermission: true,
  deletePermission: true,
  usesVariants: false,
  variantTableLabel: '',
}

// ─── Processes ────────────────────────────────────────────────────────────────

const importPeopleProcess: QProcessMetaData = {
  name: 'importPeople',
  label: 'Import People',
  tableName: 'person',
  isHidden: false,
  iconName: 'upload_file',
  hasPermission: true,
  stepFlow: 'LINEAR',
  minInputRecords: 0,
  maxInputRecords: 0,
  frontendSteps: [
    {
      name: 'upload',
      label: 'Upload CSV',
      components: [
        {
          type: 'HELP_TEXT',
          values: { text: 'Upload a CSV file containing person records. The file must include firstName, lastName, and email columns.' },
        },
      ],
      formFields: [
        field('file', 'CSV File', 'BLOB', {
          isRequired: true,
          adornments: [{ type: 'FILE_UPLOAD' }],
        }),
      ],
    },
    {
      name: 'validate',
      label: 'Validate',
      components: [
        {
          type: 'VALIDATION_REVIEW_SCREEN',
        },
      ],
    },
    {
      name: 'confirm',
      label: 'Confirm Import',
      components: [
        {
          type: 'PROCESS_SUMMARY_RESULTS',
        },
      ],
    },
  ],
}

const sendEmailProcess: QProcessMetaData = {
  name: 'sendEmail',
  label: 'Send Email',
  tableName: 'person',
  isHidden: false,
  iconName: 'email',
  hasPermission: true,
  stepFlow: 'LINEAR',
  minInputRecords: 1,
  maxInputRecords: 100,
  frontendSteps: [
    {
      name: 'compose',
      label: 'Compose',
      components: [
        {
          type: 'EDIT_FORM',
        },
      ],
      formFields: [
        field('subject', 'Subject', 'STRING', { isRequired: true, maxLength: 200 }),
        field('body', 'Body', 'TEXT', { isRequired: true }),
      ],
    },
    {
      name: 'preview',
      label: 'Preview',
      components: [
        {
          type: 'VIEW_FORM',
        },
      ],
      viewFields: [
        field('subject', 'Subject', 'STRING'),
        field('body', 'Body', 'TEXT'),
        field('recipientCount', 'Recipients', 'INTEGER'),
      ],
    },
    {
      name: 'send',
      label: 'Sent',
      components: [
        {
          type: 'PROCESS_SUMMARY_RESULTS',
        },
      ],
    },
  ],
}

const fulfillOrderProcess: QProcessMetaData = {
  name: 'fulfillOrder',
  label: 'Fulfill Order',
  tableName: 'order',
  isHidden: false,
  iconName: 'local_shipping',
  hasPermission: true,
  stepFlow: 'LINEAR',
  minInputRecords: 1,
  maxInputRecords: 1,
  frontendSteps: [
    {
      name: 'confirm',
      label: 'Confirm Fulfillment',
      components: [{ type: 'EDIT_FORM' }],
      formFields: [
        field('trackingNumber', 'Tracking Number', 'STRING', { isRequired: true, maxLength: 100 }),
        field('carrier', 'Carrier', 'STRING', { isRequired: true, maxLength: 100 }),
        field('notes', 'Notes', 'TEXT'),
      ],
    },
    {
      name: 'result',
      label: 'Fulfilled',
      components: [{ type: 'PROCESS_SUMMARY_RESULTS' }],
    },
  ],
}

const cancelOrderProcess: QProcessMetaData = {
  name: 'cancelOrder',
  label: 'Cancel Order',
  tableName: 'order',
  isHidden: false,
  iconName: 'cancel',
  hasPermission: true,
  stepFlow: 'LINEAR',
  minInputRecords: 1,
  maxInputRecords: 1,
  frontendSteps: [
    {
      name: 'reason',
      label: 'Cancel Reason',
      components: [{ type: 'EDIT_FORM' }],
      formFields: [
        field('reason', 'Cancellation Reason', 'TEXT', { isRequired: true }),
      ],
    },
    {
      name: 'result',
      label: 'Cancelled',
      components: [{ type: 'PROCESS_SUMMARY_RESULTS' }],
    },
  ],
}

const bulkUpdateStatusProcess: QProcessMetaData = {
  name: 'bulkUpdateOrderStatus',
  label: 'Update Status',
  tableName: 'order',
  isHidden: false,
  iconName: 'sync',
  hasPermission: true,
  stepFlow: 'LINEAR',
  minInputRecords: 1,
  maxInputRecords: 1000,
  frontendSteps: [
    {
      name: 'selectStatus',
      label: 'Select New Status',
      components: [{ type: 'EDIT_FORM' }],
      formFields: [
        field('newStatus', 'New Status', 'STRING', {
          isRequired: true,
          possibleValueSourceName: 'orderStatus',
        }),
      ],
    },
    {
      name: 'review',
      label: 'Review',
      components: [{ type: 'RECORD_LIST' }],
    },
    {
      name: 'result',
      label: 'Updated',
      components: [{ type: 'PROCESS_SUMMARY_RESULTS' }],
    },
  ],
}

// ─── Widgets ─────────────────────────────────────────────────────────────────

const inventoryWidgets: Record<string, QWidgetMetaData> = {
  invKpis: {
    name: 'invKpis',
    label: 'Inventory Overview',
    type: 'statistics',
    hasPermission: true,
    gridColumns: 3,
  },
  invStockByCategory: {
    name: 'invStockByCategory',
    label: 'Stock Units by Category',
    type: 'chart',
    hasPermission: true,
    gridColumns: 2,
  },
  invLowStockCount: {
    name: 'invLowStockCount',
    label: 'Reorder Required',
    type: 'statistics',
    hasPermission: true,
    gridColumns: 1,
  },
  invValueTrend: {
    name: 'invValueTrend',
    label: 'Inventory Value Trend',
    type: 'chart',
    hasPermission: true,
    gridColumns: 3,
  },
  invLowStockItems: {
    name: 'invLowStockItems',
    label: 'Products Needing Reorder',
    type: 'recordGrid',
    hasPermission: true,
    gridColumns: 3,
  },
}

const crmWidgets: Record<string, QWidgetMetaData> = {
  crmTotalPeople: {
    name: 'crmTotalPeople',
    label: 'Total People',
    type: 'statistics',
    hasPermission: true,
  },
  crmActiveCompanies: {
    name: 'crmActiveCompanies',
    label: 'Active Companies',
    type: 'statistics',
    hasPermission: true,
  },
  crmOpenOrders: {
    name: 'crmOpenOrders',
    label: 'Open Orders',
    type: 'statistics',
    hasPermission: true,
  },
  crmMonthlyRevenue: {
    name: 'crmMonthlyRevenue',
    label: 'Monthly Revenue',
    type: 'statistics',
    hasPermission: true,
  },
  crmOrdersByStatus: {
    name: 'crmOrdersByStatus',
    label: 'Orders by Status',
    type: 'chart',
    hasPermission: true,
  },
  crmRevenueChart: {
    name: 'crmRevenueChart',
    label: 'Revenue (Last 12 Months)',
    type: 'chart',
    hasPermission: true,
  },
  crmRecentOrders: {
    name: 'crmRecentOrders',
    label: 'Recent Orders',
    type: 'recordGrid',
    hasPermission: true,
  },
}

// ─── App tree nodes ───────────────────────────────────────────────────────────

const crmTreeNode: QAppTreeNode = {
  name: 'crm',
  label: 'CRM',
  type: 'APP',
  iconName: 'people_alt',
  children: [
    { name: 'person', label: 'People', type: 'TABLE', iconName: 'person' },
    { name: 'company', label: 'Companies', type: 'TABLE', iconName: 'business' },
    { name: 'order', label: 'Orders', type: 'TABLE', iconName: 'shopping_cart' },
    { name: 'importPeople', label: 'Import People', type: 'PROCESS', iconName: 'upload_file' },
    { name: 'sendEmail', label: 'Send Email', type: 'PROCESS', iconName: 'email' },
    { name: 'fulfillOrder', label: 'Fulfill Order', type: 'PROCESS', iconName: 'local_shipping' },
    { name: 'bulkUpdateOrderStatus', label: 'Update Status', type: 'PROCESS', iconName: 'sync' },
  ],
}

const inventoryTreeNode: QAppTreeNode = {
  name: 'inventory',
  label: 'Inventory',
  type: 'APP',
  iconName: 'inventory',
  children: [
    { name: 'product', label: 'Products', type: 'TABLE', iconName: 'inventory_2' },
    { name: 'supplier', label: 'Suppliers', type: 'TABLE', iconName: 'local_shipping' },
  ],
}

// ─── App metadata ─────────────────────────────────────────────────────────────

const crmApp: QAppMetaData = {
  name: 'crm',
  label: 'CRM',
  iconName: 'people_alt',
  widgets: [
    'crmTotalPeople',
    'crmActiveCompanies',
    'crmOpenOrders',
    'crmMonthlyRevenue',
    'crmOrdersByStatus',
    'crmRevenueChart',
    'crmRecentOrders',
  ],
  children: crmTreeNode.children ?? [],
  sections: [
    {
      name: 'contacts',
      label: 'Contacts',
      icon: { name: 'contacts' },
      tables: ['person', 'company'],
      processes: [],
      reports: [],
    },
    {
      name: 'sales',
      label: 'Sales',
      icon: { name: 'attach_money' },
      tables: ['order'],
      processes: ['importPeople', 'sendEmail', 'fulfillOrder', 'cancelOrder', 'bulkUpdateOrderStatus'],
      reports: [],
    },
  ],
}

const inventoryApp: QAppMetaData = {
  name: 'inventory',
  label: 'Inventory',
  iconName: 'inventory',
  widgets: ['invKpis', 'invStockByCategory', 'invLowStockCount', 'invValueTrend', 'invLowStockItems'],
  children: inventoryTreeNode.children ?? [],
  sections: [
    {
      name: 'catalog',
      label: 'Catalog',
      icon: { name: 'category' },
      tables: ['product', 'supplier'],
      processes: [],
      reports: [],
    },
  ],
}

// ─── QInstance export ─────────────────────────────────────────────────────────

export const qInstance: QInstance = {
  apps: {
    crm: crmApp,
    inventory: inventoryApp,
  },
  appTree: [crmTreeNode, inventoryTreeNode],
  tables: {
    person: personTable,
    company: companyTable,
    order: orderTable,
    orderLine: orderLineTable,
    product: productTable,
    supplier: supplierTable,
  },
  processes: {
    importPeople: importPeopleProcess,
    sendEmail: sendEmailProcess,
    fulfillOrder: fulfillOrderProcess,
    cancelOrder: cancelOrderProcess,
    bulkUpdateOrderStatus: bulkUpdateStatusProcess,
  },
  reports: {},
  widgets: { ...crmWidgets, ...inventoryWidgets },
  branding: {
    companyName: 'QQQ Demo',
    companyUrl: 'https://qqq.example.com',
    appName: 'QQQ Admin',
    logo: null as unknown as string,
    icon: null as unknown as string,
    accentColor: '#6366f1',
    banners: {
      environment: {
        text: 'Mock Development Environment — data is not real',
        severity: 'warning',
        color: '#f59e0b',
        dismissible: true,
      },
    },
  },
  helpContents: {},
  environmentValues: {
    environment: 'mock',
    version: '0.1.0-mock',
  },
}
