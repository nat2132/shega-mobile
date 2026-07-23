export interface PDFTranslations {
  receipt: {
    title: string;
    receiptNo: string;
    date: string;
    customer: string;
    payment: string;
    item: string;
    qty: string;
    price: string;
    total: string;
    subtotal: string;
    discount: string;
    vat: string;
    totalPaid: string;
    thanks: string;
    powered: string;
  };
  order: {
    title: string;
    date: string;
    supplier: string;
    phone: string;
    item: string;
    currentStock: string;
    orderQty: string;
    notes: string;
    thanks: string;
    powered: string;
  };
  invoice: {
    title: string;
    customer: string;
    phone: string;
    date: string;
    boughtDate: string;
    status: string;
    unpaid: string;
    item: string;
    qty: string;
    amount: string;
    outstanding: string;
    settle: string;
    powered: string;
  };
  reports: {
    salesTitle: string;
    stockTitle: string;
    expenseTitle: string;
    plTitle: string;
    productTitle: string;
    period: string;
    dateGenerated: string;
    summary: string;
    inflow: string;
    outflow: string;
    netProfit: string;
    netLoss: string;
    revenue: string;
    cost: string;
    grossProfit: string;
    expenses: string;
    valuation: string;
    assets: string;
    lowStock: string;
    health: string;
    itemCount: string;
    sellingPrice: string;
    purchasePrice: string;
    category: string;
    status: string;
    date: string;
    description: string;
    amount: string;
    total: string;
    powered: string;
    totalOrders: string;
    volumeSold: string;
    itemName: string;
    quantity: string;
    payment: string;
    stockLevel: string;
    id: string;
    productName: string;
    manufacturer: string;
    purchaseCost: string;
    totalQty: string;
    frequency: string;
    recurring: string;
    oneTime: string;
    optimal: string;
    activeTracking: string;
    grossSalesInflow: string;
    directCost: string;
    operationalExpenses: string;
    brandCompany: string;
  };
  common: {
    day: string;
    night: string;
    am: string;
    pm: string;
    nA: string;
    walkInCustomer: string;
    cash: string;
    general: string;
    pcs: string;
    shegaStore: string;
    mainBranch: string;
    multipleSuppliers: string;
    yes: string;
    no: string;
    etb: string;
  };
}

export const pdfTranslations: Record<'en' | 'am' | 'om' | 'ti', PDFTranslations> = {
  en: {
    receipt: {
      title: "Sales Receipt",
      receiptNo: "Receipt #",
      date: "Date",
      customer: "Customer",
      payment: "Payment Method",
      item: "Item",
      qty: "Qty",
      price: "Price",
      total: "Total",
      subtotal: "Subtotal",
      discount: "Discount",
      vat: "VAT",
      totalPaid: "Total Paid",
      thanks: "Thank you for your business!",
      powered: "Powered by Shega Mobile"
    },
    order: {
      title: "Low Stock Product Order",
      date: "Order Date",
      supplier: "Supplier Contact",
      phone: "Phone",
      item: "Product Name",
      currentStock: "Current Stock",
      orderQty: "Order Qty",
      notes: "Notes/Specs",
      thanks: "Please expedite this restock order.",
      powered: "Generated via Shega Mobile"
    },
    invoice: {
      title: "Customer Debt Invoice",
      customer: "Customer Name",
      phone: "Phone",
      date: "Date Generated",
      boughtDate: "Bought Date",
      status: "Payment Status",
      unpaid: "UNPAID / OUTSTANDING",
      item: "Purchased Item",
      qty: "Quantity",
      amount: "Amount",
      outstanding: "Total Outstanding Balance",
      settle: "Please settle the outstanding balance at your earliest convenience.",
      powered: "Powered by Shega Mobile"
    },
    reports: {
      salesTitle: "Sales Performance Report",
      stockTitle: "Stock Valuation & Health Report",
      expenseTitle: "Operational Expense Report",
      plTitle: "Profit & Loss (P&L) Statement",
      productTitle: "Full Product Catalog List",
      period: "Report Period",
      dateGenerated: "Date Generated",
      summary: "Performance Indicators",
      inflow: "Total Revenue",
      outflow: "Total Expenses",
      netProfit: "Net profit",
      netLoss: "Net Loss",
      revenue: "Sales Revenue",
      cost: "Cost of Goods Sold (COGS)",
      grossProfit: "Gross Profit Margin",
      expenses: "Operating Expenses",
      valuation: "Total Inventory Value",
      assets: "Total Unique Products",
      lowStock: "Low Stock Deficit Items",
      health: "Stock Health Index",
      itemCount: "Total Quantity",
      sellingPrice: "Selling Price (Base)",
      purchasePrice: "Purchase Price (Base)",
      category: "Category",
      status: "Status",
      date: "Transaction Date",
      description: "Description",
      amount: "Amount",
      total: "Grand Total",
      powered: "Orchestrated via Shega Mobile",
      totalOrders: "Total Orders",
      volumeSold: "Volume Sold",
      itemName: "Item Name",
      quantity: "Quantity",
      payment: "Payment",
      stockLevel: "Stock Level",
      id: "ID",
      productName: "Product Name",
      manufacturer: "Manufacturer",
      purchaseCost: "Purchase Cost",
      totalQty: "Total Qty",
      frequency: "Frequency",
      recurring: "Recurring",
      oneTime: "One-time",
      optimal: "Optimal",
      activeTracking: "Active sales tracking",
      grossSalesInflow: "Gross Sales Inflow",
      directCost: "Direct Cost of Inventory Sold",
      operationalExpenses: "Operational & Recurring Expenses",
      brandCompany: "Brand / Company"
    },
    common: {
      day: "Day",
      night: "Night",
      am: "AM",
      pm: "PM",
      nA: "N/A",
      walkInCustomer: "Walk-in Customer",
      cash: "Cash",
      general: "General",
      pcs: "pcs",
      shegaStore: "Shega Store",
      mainBranch: "Main Branch",
      multipleSuppliers: "Multiple Restock Suppliers",
      yes: "Yes",
      no: "No",
      etb: "ETB"
    }
  },
  am: {
    receipt: {
      title: "የሽያጭ ደረሰኝ",
      receiptNo: "ደረሰኝ ቁጥር",
      date: "ቀን",
      customer: "ደንበኛ",
      payment: "የክፍያ ሁኔታ",
      item: "ዕቃ",
      qty: "ብዛት",
      price: "ዋጋ",
      total: "ድምር",
      subtotal: "ንኡስ ድምር",
      discount: "ቅናሽ",
      vat: "ተጨማሪ እሴት ታክስ",
      totalPaid: "ጠቅላላ ክፍያ",
      thanks: "ስለ መረጡን እናመሰግናለን!",
      powered: "በሸጋ ሞባይል የተዘጋጀ"
    },
    order: {
      title: "ዝቅተኛ ክምችት ምርት ማዘዣ",
      date: "የትእዛዝ ቀን",
      supplier: "አቅራቢ",
      phone: "ስልክ",
      item: "ምርት ስም",
      currentStock: "ያለ ክምችት",
      orderQty: "የታዘዘ ብዛት",
      notes: "ተጨማሪ መግለጫ",
      thanks: "እባክዎን ይህንን ዝርዝር በፍጥነት ያቅርቡልን።",
      powered: "በሸጋ ሞባይል የተዘጋጀ"
    },
    invoice: {
      title: "የደንበኛ ዕዳ ደረሰኝ",
      customer: "የደንበኛ ስም",
      phone: "ስልክ ቁጥር",
      date: "የወጣበት ቀን",
      boughtDate: "የተገዛበት ቀን",
      status: "የክፍያ ሁኔታ",
      unpaid: "ያልተከፈለ ዕዳ",
      item: "የተገዛ ዕቃ",
      qty: "ብዛት",
      amount: "ድምር ዋጋ",
      outstanding: "ጠቅላላ ያለበት ዕዳ",
      settle: "እባክዎ ያለብዎትን ቀሪ ዕዳ በተቻለ ፍጥነት ይክፈሉ ያጠናቁ።",
      powered: "በሸጋ ሞባይል የተዘጋጀ"
    },
    reports: {
      salesTitle: "የሽያጭ አፈፃፀም ሪፖርት",
      stockTitle: "የክምችት ግምገማና ጤና ሪፖርት",
      expenseTitle: "የአሠራር ወጪ ሪፖርት",
      plTitle: "የትርፍና ኪሳራ (P&L) መግለጫ",
      productTitle: "የምርቶች ዝርዝር ማውጫ",
      period: "የሪፖርት ጊዜ",
      dateGenerated: "ሪፖርቱ የወጣበት ቀን",
      summary: "አጠቃላይ የአፈጻጸም አመልካቾች",
      inflow: "ጠቅላላ ገቢ",
      outflow: "ጠቅላላ ወጪ",
      netProfit: "የተጣራ ትርፍ",
      netLoss: "የተጣራ ኪሳራ",
      revenue: "የሽያጭ ገቢ",
      cost: "የተሸጡ ዕቃዎች ዋጋ (COGS)",
      grossProfit: "አጠቃላይ ትርፍ",
      expenses: "የአሠራር ወጪዎች",
      valuation: "ጠቅላላ የክምችት ዋጋ",
      assets: "ልዩ የሆኑ ምርቶች ብዛት",
      lowStock: "ማስጠንቀቂያ ላይ ያሉ ምርቶች",
      health: "የክምችት ጤና ኢንዴክስ",
      itemCount: "ጠቅላላ ብዛት",
      sellingPrice: "መሸጫ ዋጋ (ነጠላ)",
      purchasePrice: "መግዣ ዋጋ (ነጠላ)",
      category: "ምድብ",
      status: "ሁኔታ",
      date: "የግብይት ቀን",
      description: "ማብራሪያ",
      amount: "የገንዘብ መጠን",
      total: "አጠቃላይ ድምር",
      powered: "በሸጋ ሞባይል የተቀናበረ",
      totalOrders: "ጠቅላላ ትዕዛዞች",
      volumeSold: "የተሸጠ መጠን",
      itemName: "የዕቃ ስም",
      quantity: "ብዛት",
      payment: "ክፍያ",
      stockLevel: "የክምችት ደረጃ",
      id: "መለያ",
      productName: "የምርት ስም",
      manufacturer: "አምራች",
      purchaseCost: "የግዢ ዋጋ",
      totalQty: "ጠቅላላ ብዛት",
      frequency: "ድግግሞሽ",
      recurring: "ደጋሚ",
      oneTime: "አንድ ጊዜ",
      optimal: "ምርጥ",
      activeTracking: "ንቁ ሽያጭ ተከታታይ",
      grossSalesInflow: "ጠቅላላ የሽያጭ ገቢ",
      directCost: "የተሸጠ ክምችት ቀጥታ ዋጋ",
      operationalExpenses: "የአሠራር እና ደጋሚ ወጪዎች",
      brandCompany: "ብራንድ / ኩባንያ"
    },
    common: {
      day: "ቀን",
      night: "ምሽት",
      am: "ጠዋት",
      pm: "ከሰዓት",
      nA: "የለም",
      walkInCustomer: "መግቢያ ደንበኛ",
      cash: "ጥሬ ገንዘብ",
      general: "አጠቃላይ",
      pcs: "ቁጥር",
      shegaStore: "ሸጋ ሱቅ",
      mainBranch: "ዋና ቅርንጫፍ",
      multipleSuppliers: "ተጨማሪ አቅራቢያዎች",
      yes: "አዎ",
      no: "አይደለም",
      etb: "ብር"
    }
  },
  om: {
    receipt: {
      title: "Nagee Gurgurtaa",
      receiptNo: "Lak. Nagee",
      date: "Guyyaa",
      customer: "Maamila",
      payment: "Malleen Kafaltii",
      item: "Meeshaalee",
      qty: "Baay'ina",
      price: "Gatii",
      total: "Dimshaash",
      subtotal: "Kutaa Dimshaash",
      discount: "Hir'isa",
      vat: "Taaksii (VAT)",
      totalPaid: "Kafalameera",
      thanks: "Waan nu filattaniif galatoomaa!",
      powered: "Shega Mobile kanaan kan qophaaye"
    },
    order: {
      title: "Ajaja Meeshaalee Hir'atan Gurgurtaa",
      date: "Guyyaa Ajajaa",
      supplier: "Quunnamtii Dhiyeessaa",
      phone: "Bilbila",
      item: "Maqaa Oomishaa",
      currentStock: "Kuusaa Jiru",
      orderQty: "Baay'ina Ajajame",
      notes: "Yaadannoo",
      thanks: "Maaloo ajaja meeshaalee kana nuuf ariifachiisaa.",
      powered: "Shega Mobile kanaan kan qophaaye"
    },
    invoice: {
      title: "Nagee Liqii Maamiltootaa",
      customer: "Maqaa Maamilaa",
      phone: "Bilbila",
      date: "Guyyaa Qophaa'e",
      boughtDate: "Guyyaa Bitame",
      status: "Haala Kafaltii",
      unpaid: "KAN HIN KAFALAMNE",
      item: "Meeshaalee Bitame",
      qty: "Baay'ina",
      amount: "Gatii",
      outstanding: "Idaa Waliigalaa Qabu",
      settle: "Maaloo idaa waliigalaa qabdan yeroo gabaabaa keessatti nuuf xumuraa.",
      powered: "Shega Mobile kanaan kan qophaaye"
    },
    reports: {
      salesTitle: "Gabaasa Raawwii Gurgurtaa",
      stockTitle: "Gabaasa Gatii fi Fayyummaa Kuusaa",
      expenseTitle: "Gabaasa Baasii Hojii",
      plTitle: "Ibsa Bu'aa fi Kisaaraa (P&L)",
      productTitle: "Tarree Meeshaalee Guutuu",
      period: "Barbaadame",
      dateGenerated: "Guyyaa Qophaa'e",
      summary: "Agarsiiftuu Hojii Waliigalaa",
      inflow: "Gali Waliigalaa",
      outflow: "Baasii Waliigalaa",
      netProfit: "Bu'aa Qulqulluu",
      netLoss: "Kisaaraa Qulqulluu",
      revenue: "Gali Gurgurtaa",
      cost: "Gatii Meeshaalee Gurguraman (COGS)",
      grossProfit: "Bu'aa Waliigalaa",
      expenses: "Baasii Hojii Waliigalaa",
      valuation: "Gatii Kuusaa Waliigalaa",
      assets: "Meeshaalee Addaa",
      lowStock: "Meeshaalee Kuusaa Hir'atan",
      health: "Fayyummaa Kuusaa",
      itemCount: "Baay'ina Waliigalaa",
      sellingPrice: "Gatii Gurgurtaa (Giddugala)",
      purchasePrice: "Gatii Bittaa (Giddugala)",
      category: "Ramaddii",
      status: "Haala",
      date: "Guyyaa Hojii",
      description: "Ibsa Baasii",
      amount: "Maallaqa",
      total: "Dimshaash Waliigalaa",
      powered: "Shega Mobile kanaan kan qophaaye",
      totalOrders: "Ajajawwan Waliigalaa",
      volumeSold: "Baay'ina Gurgurame",
      itemName: "Maqaa Meeshaalee",
      quantity: "Baay'ina",
      payment: "Kafaltii",
      stockLevel: "Sadarkaa Kuusaa",
      id: "Abbooxxuu",
      productName: "Maqaa Oomishaa",
      manufacturer: "Oomishaa Qophaayyuu",
      purchaseCost: "Gatii Bitaa",
      totalQty: "Baay'ina Waliigalaa",
      frequency: "Yeroo Dhuunfaa",
      recurring: "Yeroo Dhuunfaa",
      oneTime: "Yeroo Tokko",
      optimal: "Milkaa'ina",
      activeTracking: "Gurgurtaan nagaan guyyaa",
      grossSalesInflow: "Gali Gurgurtaa Guutuu",
      directCost: "Gatii Kuusaa Bitame Dachaa",
      operationalExpenses: "Baasii Hojii fi Baasii Dhuunfaa",
      brandCompany: "Biraandii / Kampanii"
    },
    common: {
      day: "Guyyaa",
      night: "Halkan",
      am: "WD",
      pm: "WB",
      nA: "Tuu hin jiru",
      walkInCustomer: "Maamila Seeraa",
      cash: "Maallaqa Caafaa",
      general: "Waliigalaa",
      pcs: "citaa",
      shegaStore: "Dukaan Shega",
      mainBranch: "Cita Haadhaa",
      multipleSuppliers: "Dhiyeessoota hedduu",
      yes: "Eeyyee",
      no: "Lakki",
      etb: "Birr"
    }
  },
  ti: {
    receipt: {
      title: "ደረሰኝ መሸጫ",
      receiptNo: "ደረሰኝ ቑፅሪ",
      date: "ዕለት",
      customer: "ዓሚል",
      payment: "ክፍሊት ኩነታት",
      item: "ዕቃ",
      qty: "ብዝሒ",
      price: "ዋጋ",
      total: "ድምር",
      subtotal: "ንኡስ ድምር",
      discount: "ቅናሽ",
      vat: "ተወሳኺ እሴት ታክስ",
      totalPaid: "ጠቕላላ ክፍሊት",
      thanks: "ነዚ ስለ ዝመረፁና ነመስግን!",
      powered: "ብሸጋ ሞባይል ዝተዳለወ"
    },
    order: {
      title: "ትእዛዝ ውሑድ ክምችት ዘለዎም ፍርያት",
      date: "ዕለት ትእዛዝ",
      supplier: "ኣቕራቢ ርክብ",
      phone: "ስልኪ ቁፅሪ",
      item: "ስም ፍርያት",
      currentStock: "ዘሎ ክምችት",
      orderQty: "ዝእዘዝ ብዝሒ",
      notes: "ተወሳኺ ሓበሬታ",
      thanks: "እባክኹም ነዚ ዝርዝር ፍርያት ብቕልጡፍ የቕርቡልና።",
      powered: "ብሸጋ ሞባይል ዝተዳለወ"
    },
    invoice: {
      title: "ናይ ዓሚል ዕዳ ደረሰኝ",
      customer: "ስም ዓሚል",
      phone: "ስልኪ ቁፅሪ",
      date: "ዝወፀሉ ዕለት",
      boughtDate: "ዝተገዛሉ ዕለት",
      status: "ኩነታት ክፍሊት",
      unpaid: "ዘይተኸፈለ ዕዳ",
      item: "ዝተዓደገ ዕቃ",
      qty: "ብዝሒ",
      amount: "ድምር ዋጋ",
      outstanding: "ጠቕላላ ዘሎ ዕዳ",
      settle: "በጃኹም ዘለኩም ዕዳ ብዝተኻእለ መጠን ብቕልጡፍ ክትከፍሉ ንላቦ።",
      powered: "ብሸጋ ሞባይል ዝተዳለወ"
    },
    reports: {
      salesTitle: "ናይ መሻይጥ አፈፃፅማ ሪፖርት",
      stockTitle: "ናይ ክምችት ገምጋምን ጥዕናን ሪፖርት",
      expenseTitle: "ናይ ስራሕ ወፃኢ ሪፖርት",
      plTitle: "ናይ መኽሰብን ክሳራን (P&L) መግለፂ",
      productTitle: "ናይ ፍርያት ዝርዝር መውፅኢ",
      period: "ናይ ሪፖርት እዋን",
      dateGenerated: "ሪፖርት ዝተዳለወሉ ዕለት",
      summary: "ሓፈሻዊ ናይ ስራሕ መርኣይታት",
      inflow: "ጠቕላላ እቶት",
      outflow: "ጠቕላላ ወፃኢ",
      netProfit: "ዝተፃረየ መኽሰብ",
      netLoss: "ዝተፃረየ ክሳራ",
      revenue: "ናይ መሻይጥ እቶት",
      cost: "ዝተሸጡ ኣቑሑት ዋጋ (COGS)",
      grossProfit: "ሓፈሻዊ መኽሰብ",
      expenses: "ናይ ስራሕ ወፃኢታት",
      valuation: "ጠቕላላ ናይ ክምችት ዋጋ",
      assets: "ፍሉይ ፍርያት ብዝሒ",
      lowStock: "ውሑድ ክምችት ዘለዎም ፍርያት",
      health: "ናይ ጥዕና ክምችት መርኣይ",
      itemCount: "ጠቕላላ ብዝሒ",
      sellingPrice: "መሸጣ ዋጋ (ነጠላ)",
      purchasePrice: "መግዝኢ ዋጋ (ነጠላ)",
      category: "ዓይነት ምድብ",
      status: "ኩነታት",
      date: "ዕለት ግብይት",
      description: "መብራህረሂ",
      amount: "መጠንን ገንዘብ",
      total: "ሓፈሻዊ ድምር",
      powered: "ብሸጋ ሞባይል ዝተዳለወ",
      totalOrders: "ጠቕላላ ትእዛዛት",
      volumeSold: "ዝተሸጠ ብዝሒ",
      itemName: "ስም ዕቃ",
      quantity: "ብዝሒ",
      payment: "ክፍሊት",
      stockLevel: "ደረጃ ክምችት",
      id: "መለለዪ",
      productName: "ስም ፍርያት",
      manufacturer: "ምስልቃነን",
      purchaseCost: "ናይ ግዝ游戏代 cost",
      totalQty: "ጠቕላላ ብዝሒ",
      frequency: "ድግስ ዘይኮይኖ",
      recurring: "ዝቕልል",
      oneTime: "ንሓንሳው",
      optimal: "ምርጡ",
      activeTracking: "ንቁ መሻይጥ ተከታይ",
      grossSalesInflow: "ሓፈሻዊ እቶት መሻይጥ",
      directCost: "ናይ ዝተወሰኸ ክምችት ቀጥታ ዋጋ",
      operationalExpenses: "ናይ ስራሕ ወፃኢን ዝቕልል ወፃኢታትን",
      brandCompany: "ብራንድ / ኩባንያ"
    },
    common: {
      day: "ደይ",
      night: "ምሽቲ",
      am: "ንጋት",
      pm: "ከiensatz",
      nA: "ኣይተገኘን",
      walkInCustomer: "ddenan Khidma",
      cash: "ከASH",
      general: "ሓፈሻዊ",
      pcs: "ቕርጺ",
      shegaStore: "ሸጋ ሱቅ",
      mainBranch: "ዋና ቅርጻ",
      multipleSuppliers: "ተወሳኺ ኣቕራቢታት",
      yes: "ኣዎ",
      no: "ኣይኮንን",
      etb: "ብር"
    }
  }
};
