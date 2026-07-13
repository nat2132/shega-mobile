const fs = require('fs');
const entries = [];

function add(en, am, om, ti) {
  entries.push({en, am, om, ti});
}

// Common UI
add('Close', 'ዝጋ', 'Cufi', 'ዕጸው');
add('Done', 'ተከናውኗል', 'Xumurame', 'ተፈጺሙ');
add('Next', 'ቀጣይ', 'Kan itti aanuu', 'ዝቕጽል');
add('Restart', 'እንደገና ጀምር', 'Irra deebii jalqabi', 'ዳግማይ ጀምር');
add('Start Tutorial', 'አጋዥ ስልጠና ይጀምሩ', 'Leenjii jalqabi', 'መምርሒ ጀምር');
add('Scroll the highlighted area', 'የደመቀውን ቦታ ያሸብልሉ', 'Bakka ibsames suuqi', 'ነቲ ዝተሓበረ ቦታ ስብልልዎ');
add('Swipe the highlighted area', 'የደመቀውን ቦታ ያንሸራትቱ', 'Bakka ibsames siigi', 'ነቲ ዝተሓበረ ቦታ ኣንሸራትዎ');
add('Tap the highlighted element', 'የደመቀውን አካል ይንኩ', 'Qaama ibsames tuqi', 'ነቲ ዝተሓበረ ክፋል ጠውቑ');
add('Type in the highlighted field', 'የደመቀውን መስክ ያስገቡ', 'Dirree ibsames keessa barreessi', 'ኣብቲ ዝተሓበረ ቦታ ጸሓፉ');
add('You completed this tutorial! Take a refresher or restart.', 'ይህን አጋዥ ስልጠና አጠናቀዋል! እንደገና ይከልሱ ወይም እንደገና ይጀምሩ።', 'Leenjii kana xumurte! Irra deebii ilaali ykn irra deebii jalqabi.', 'ነዚ መምርሒ ፈጺምኩሞ! ብድጋሚ ምርምር ወይ ዳግማይ ጀምሩ።');
add('Continue from step {step}', 'ከ{step} ደረጃ ቀጥል', 'Tarkaanfata {step} irraa itti fufi', 'ካብ ደረጃ {step} ቀጽል');
add('Continue ({current}/{total})', 'ቀጥል ({current}/{total})', 'Itti fufi ({current}/{total})', 'ቀጽል ({current}/{total})');
add('Learn how to use this screen step by step.', 'ይህን ስክሪን ደረጃ በደረጃ እንዴት እንደሚጠቀሙ ይማሩ።', 'Iskiriinii kana tarkaanfataan tarkaanfataan akka itti fayyadamtu baradhu.', 'ነዛ ስክሪን ደረጃ ብደረጃ ከመይ ከም እትጥቀምዋ ተምሃሩ።');
add('Tutorial Complete!', 'አጋዥ ስልጠና ተጠናቋል!', 'Leenjii xumurameera!', 'መምርሒ ተወዲኡ!');
add('{name} Tutorial', 'የ{name} አጋዥ ስልጠና', 'Leenjii {name}', 'መምርሒ {name}');
add('Tutorial Complete!', 'አጋዥ ስልጠና ተጠናቋል!', 'Leenjii xumurameera!', 'መምርሒ ተወዲኡ!');

// Activity Ledger
add('Activity Ledger', 'የእንቅስቃሴ መዝገብ', 'Galmee Sochii', 'መዝገብ ንጥፈታት');
add('View all business activity', 'ሁሉንም የንግድ እንቅስቃሴ ይመልከቱ', 'Sochii daldalaa hunda ilaali', 'ንጥፈታት ንግዲ ብምሉኡ ርአ');
add('Activity Feed', 'የእንቅስቃሴ መግብ', 'Sochii Feedii', 'መጋብ ንጥፈታት');
add('This is your business activity feed — every transaction, adjustment, and event recorded in chronological order.', 'ይህ የንግድ እንቅስቃሴ መግብዎ ነው — እያንዳንዱ ግብይት፣ ማስተካከያ እና ክስተት በጊዜ ቅደም ተከተል የተመዘገበ።', 'Kun sochii daldalaa kee feedii — jijjiirama gatii, sirreeffamoota, fi gochiiwwan hunduu yeroo tartiibaan galmeeffaman.', 'እዚ መጋብ ንጥፈታት ንግድኩም እዩ — ነፍሲ ወከፍ ልውውጥ፣ ምትእርራይ ከምኡውን ኣጋጣሚ ብቅደም ተከተል ዝተመዝገበ።');
add('Filter Activity', 'እንቅስቃሴ አጣራ', 'Sochii calleessii', 'ንጥፈታት ኣጣርሩ');
add('Every action is listed here: sales, expenses, inventory changes, price adjustments, and payments received.', 'እያንዳንዱ ድርጊት እዚህ ተዘርዝሯል፦ ሽያጮች፣ ወጪዎች፣ የክምችት ለውጦች፣ የዋጋ ማስተካከያዎች እና የተቀበሉ ክፍያዎች።', 'Gochiiwwan hunduma asitti tarreeffaman: gurgurtaalee, baasii, jijjiirama kuusaa, sirreeffama gatii, fi kaffaltiiwwan fudhataman.', 'ነፍሲ ወከፍ ተግባር ኣብዚ ተዘርዚሩ ኣሎ፦ ሽያጣት፣ ወጻኢታት፣ ምቕያር ክምችት፣ ምትእርራይ ዋጋ ከምኡውን እተቐበሉ ክፍሊታት።');
add('Filter by activity type (sales, expenses, inventory, payments) or date range to find specific events.', 'የተወሰኑ ክስተቶችን ለማግኘት በእንቅስቃሴ አይነት (ሽያጭ፣ ወጪ፣ ክምችት፣ ክፍያ) ወይም በቀን ክልል አጣራ።', 'Gosa sochii (gurgurtaa, baasii, kuusaa, kaffaltii) ykn daangaa guyyaatiin calleessii gochaalee addaa argachuuf.', 'ብኣይነት ንጥፈታት (ሽያጥ፣ ወጻኢ፣ ክምችት፣ ክፍሊት) ወይ ብዝምድና መዓልቲ ንፍሉያት ኣጋጣሚታት ንምርካብ ኣጣርሩ።');

// Add Order Item
add('Add Order Item', 'የትእዛዝ ዕቃ ጨምር', 'Meelata Ajaja Idaatii', 'ዕቃ ትእዛዝ ወስኽ');
add('Add products to a purchase order', 'ምርቶችን ወደ የግዢ ትእዛዝ ያክሉ', 'Oomishaalee ajaja bitaa irratti idaati', 'ምርታት ናብ ትእዛዝ ግዢ ወስኹ');
add('Adding an Order Item', 'የትእዛዝ ዕቃ በመጨመር ላይ', 'Meelata Ajaja Idachaatti', 'ዕቃ ትእዛዝ ይውሰኽ ኣሎ');
add('Follow these steps to add a product to your purchase order. You can search for existing inventory items or enter a custom description.', 'ምርት ወደ የግዢ ትእዛዝዎ ለመጨመር እነዚህን ደረጃዎች ይከተሉ። ያሉትን የክምችት ዕቃዎች መፈለግ ወይም ብጁ መግለጫ ማስገባት ይችላሉ።', 'Tarkaanfiiwwan kana hordofi oomishaa ajaja bitaa keetti idaasuuf. Meelawwan kuusaa jiran barbaaduu ykn ibsa ofii barreessuu dandeessa.', 'ነዞም ደረጃታት ተኸተሉ ምርት ናብ ትእዛዝ ግዢኩም ንምውስኽ። ንዘለዉ እቃታት ክምችት ክትደልዩ ወይ ብጁ መግለጺ ከተእትዉ ትኽእሉ ኢኹም።');
add('Item Name', 'የዕቃ ስም', 'Maqaa Meelataa', 'ስም ዕቃ');
add('Enter the name of the product you want to order. If it exists in inventory, it will auto-fill details.', 'ማዘዝ የሚፈልጉትን ምርት ስም ያስገቡ። በክምችት ውስጥ ካለ ዝርዝሮቹን በራስ-ሰር ይሞላል።', 'Maqaa oomishaa ajajuu barbaadduu galchi. Yoo kuusaa keessa jiraate, ofumaan guutama.', 'ስም እቲ ክትእዝዝዎ እትደልዩ ምርት ኣእትዉ። ኣብ ክምችት እንተሎ ዝርዝራት ብርእሱ ይመልእ።');
add('Supplier / Company', 'አቅራቢ / ኩባንያ', 'Dhiyeessaa / Kaampaanii', 'ኣቕራቢ / ኩባንያ');
add('Enter the supplier or company name for this item. This is useful for tracking purchases by vendor.', 'ለዚህ ዕቃ የአቅራቢውን ወይም የኩባንያውን ስም ያስገቡ። ይህ ግዢዎችን በአቅራቢ ለመከታተል ጠቃሚ ነው።', 'Maqaa dhiyeessaa ykn kaampaanii meelata kanaaf galchi. Kun bitoota dhiyeessaan hordofuuf fayya.', 'ስም ኣቕራቢ ወይ ኩባንያ ንዛ ዕቃ ኣእትዉ። እዚ ንምክትታል ግዚ በኣቕራቢ ይጠቅም እዩ።');
add('Order Quantity', 'የትእዛዝ ብዛት', 'Hamma Ajajaa', 'ብዝሒ ትእዛዝ');
add('Enter the quantity you want to order. This will be added to your purchase order.', 'ማዘዝ የሚፈልጉትን ብዛት ያስገቡ። ይህ ወደ የግዢ ትእዛዝዎ ይጨመራል።', 'Hamma ajajuu barbaaddu galchi. Kun ajaja bitaa keetti idaatama.', 'እቲ ክትእዝዝዎ እትደልዩ ብዝሒ ኣእትዉ። እዚ ናብ ትእዛዝ ግዢኩም ይውሰኽ እዩ።');
add('Add to Order', 'ወደ ትእዛዝ ጨምር', 'Ajaja Irratti Idaati', 'ናብ ትእዛዝ ወስኽ');
add('Tap to add this item to your purchase order. You can add multiple items before finalizing.', 'ይህን ዕቃ ወደ የግዢ ትእዛዝዎ ለመጨመር ይንኩ። ከማጠናቀቅዎ በፊት በርካታ ዕቃዎችን መጨመር ይችላሉ።', 'Tuqi meelata kana ajaja bitaa keetti idaasuuf. Meelawwan baayee isaan xumuruu dura idaatuu dandeessa.', 'ነዛ ዕቃ ናብ ትእዛዝ ግዢኩም ንምውስኽ ጠውቑ። ቅድሚ ምውዳእኩም ብዙሓት እቃታት ክትወስኹ ትኽእሉ ኢኹም።');

// Adjustments
add('Adjustments', 'ማስተካከያዎች', 'Sirreeffamoota', 'ምትእርራያት');
add('Adjustments Hub', 'የማስተካከያ ማዕከል', 'Waltajjii Sirreeffamaa', 'ማእከል ምትእርራይ');
add('Adjustment Types', 'የማስተካከያ ዓይነቶች', 'Gosa Sirreeffamaa', 'ኣይነታት ምትእርራይ');
add('Calibration Ledger', 'የማስተካከያ መዝገብ', 'Galmee Sirreeffamaa', 'መዝገብ ምትእርራይ');
add('Integrity Statistics', 'የታማኝነት ስታቲስቲክስ', 'Istaatistiksii Amanamummaa', 'ስታቲስቲክስ ቅንዕና');
add('Manage price and stock changes', 'የዋጋ እና የክምችት ለውጦችን ያስተዳድሩ', 'Jijjiirama gatii fi kuusaa bulchi', 'ምቕያር ዋጋን ክምችትን ኣመሓድሩ');
add('Make corrections to your inventory — price changes, damaged items, stock adjustments.', 'በክምችትዎ ላይ እርማቶችን ያድርጉ — የዋጋ ለውጦች፣ የተበላሹ ዕቃዎች፣ የክምችት ማስተካከያዎች።', 'Kuusaa kee irratti sirreeffama hojii — jijjiirama gatii, meelawwan miidhaman, sirreeffama kuusaa.', 'ኣብ ክምችትኩም ምትእርራይ ግበሩ — ምቕያር ዋጋ፣ እተበላሹ እቃታት፣ ምትእርራይ ክምችት።');
add('Choose from three types: Price Increase, Price Decrease, or Damaged Items.', 'ከሶስት ዓይነቶች ይምረጡ፦ የዋጋ መጨመሪያ፣ የዋጋ መቀነሻ፣ ወይም የተበላሹ ዕቃዎች።', 'Gosa sadii irraa filadhu: Gatiin Dabaluu, Gatiin Hirisuu, ykn Meelata Miidhame.', 'ካብ ሰለስተ ኣይነታት ምረጹ፦ ዋጋ ምውሳኽ፣ ዋጋ ምቕናስ፣ ወይ እተበላሹ እቃታት።');
add('All past adjustments are recorded here. View the audit trail for every change.', 'ሁሉም ያለፉ ማስተካከያዎች እዚህ ተመዝግበዋል። የእያንዳንዱን ለውጥ የኦዲት ዱካ ይመልከቱ።', 'Sirreeffamoota darbe hunda asitti galmeeffame. Jijjiirama hundaaf karaa qorumsaa ilaali.', 'ኩሎም ዝሓለፉ ምትእርራያት ኣብዚ ተመዝጊቦም ኣለዉ። ንነፍሲ ወከፍ ምቕያር መንገዲ ምርመራ ርአ።');
add('Track monthly corrections, capital leakage from damaged items, and overall inventory integrity.', 'ወርሃዊ እርማቶችን፣ ከተበላሹ ዕቃዎች የካፒታል ፍሳሽን እና አጠቃላይ የክምችት ትክክለኛነትን ይከታተሉ።', 'Sirreeffamoota jiisaa, hoongoo kaapitaalaa meelawwan miidhaman irraa, fi amanamummaa kuusaa walii galaa hordofi.', 'ወርሓዊ ምትእርራያት፣ ምጥፋእ ካፒታል ካብ እተበላሹ እቃታት ከምኡውን ምሉእ ቅንዕና ክምችት ክታበሉ።');

// Budget
add('Budget Management', 'የበጀት አስተዳደር', 'Bulchiinsa Baajetaa', 'ምሕደራ በጀት');
add('Plan and track spending', 'ወጪን ያቅዱ እና ይከታተሉ', 'Baasii karoorfadhuu fi hordofi', 'ወጻኢ ምድላውን ምክትታልን');
add('Budget Dashboard', 'የበጀት ዳሽቦርድ', 'Daashboordii Baajetaa', 'ዳሽቦርድ በጀት');
add('Create a Budget', 'በጀት ይፍጠሩ', 'Baajeta Uumi', 'በጀት ፍጠሩ');
add('Budget Overview', 'የበጀት አጠቃላይ እይታ', 'Irradeebii Baajetaa', 'ጠቕላላ በጀት');
add('Category Breakdown', 'የምድብ ትንተና', 'Qoodinsa Ramaddii', 'ምብራህ መደብ');
add('Monthly Trends', 'ወርሃዊ አዝማሚያዎች', 'Mallattowwan Jiisaa', 'ወርሓዊ ኣዝማሚታት');
add('Create and manage budgets for your business. Track planned vs actual spending.', 'ለንግድዎ በጀቶችን ይፍጠሩ እና ያስተዳድሩ። የታቀደ እና ትክክለኛ ወጪን ይከታተሉ።', 'Daldala keetiif baajetota uumuu fi bulchi. Baasii karoorfamee fi dhugaa hordofi.', 'ንንግድኩም በጀታት ፍጠሩ ከምኡውን ኣመሓድሩ። እተዳለወን ሃቆን ወጻኢ ክታበሉ።');
add('Tap to create a new budget. Set a name, type, period, and categories.', 'አዲስ በጀት ለመፍጠር ይንኩ። ስም፣ ዓይነት፣ ጊዜ እና ምድቦች ያዘጋጁ።', 'Tuqi baajeta haaraa uumuuf. Maqaa, gosa, yeroo, fi ramaddiiwwan galchi.', 'ሓድሽ በጀት ንምፍጣር ጠውቑ። ስም፣ ኣይነት፣ እዋን ከምኡውን መደባት ኣዘጋጅሉ።');
add('View spending by category. Each category shows planned vs actual spend.', 'ወጪን በምድብ ይመልከቱ። እያንዳንዱ ምድብ የታቀደ እና ትክክለኛ ወጪን ያሳያል።', 'Baasii ramaddiidhaan ilaali. Ramaddii tokkoon tokkoon baasii karoorfamee fi dhugaa agarsiisa.', 'ወጻኢ ብመደብ ርአ። ነፍሲ ወከፍ መደብ እተዳለወን ሃቆን ወጻኢ የርእይ እዩ።');
add('Track your budget performance over time. See monthly trends based on historical patterns.', 'የበጀት አፈጻጸምዎን በጊዜ ሂደት ይከታተሉ። በታሪካዊ መረጃ ላይ የተመሰረቱ ወርሃዊ አዝማሚያዎችን ይመልከቱ።', 'Hojiilee baajeta kee yeroo irratti hordofi. Mallattowwan jiisaa seenaa irratti hundaaan ilaali.', 'ንጥፈት በጀትኩም ኣብ ግዜ ክታበሉ። ኣብ ታሪኻዊ ልምዲ እተመርኰሱ ወርሓዊ ኣዝማሚታት ርአዩ።');

// Collect Payments
add('Collect Payments', 'ክፍያዎችን ይሰብስቡ', 'Kaffaltiiwwan Funyaanuu', 'ክፍሊታት ምእካብ');
add('Receive payments from customers', 'ከደንበኞች ክፍያ ይቀበሉ', 'Kaffaltiiwwan maamila irraa fudhadhu', 'ካብ ደንበኛታት ክፍሊት ተቐበሉ');
add('Collect Payment', 'ክፍያ ሰብስብ', 'Kaffaltii Funyaanuu', 'ክፍሊት እከቡ');
add('Select Customer', 'ደንበኛ ይምረጡ', 'Maamila Filadhu', 'ደንበኛ ምረጹ');
add('Select Items to Pay', 'ለመክፈል ዕቃዎች ይምረጡ', 'Meelawwan Kaffaluuf Filadhu', 'ክትከፍልዎም እቃታት ምረጹ');
add('Payment Amount', 'የክፍያ መጠን', 'Hamma Kaffaltii', 'መጠን ክፍሊት');
add('Payment Method', 'የክፍያ ዘዴ', 'Mala Kaffaltii', 'ኣገባብ ክፍሊት');
add('Complete Payment', 'ክፍያ አጠናቅቅ', 'Kaffaltii Xumuri', 'ክፍሊት ኣጠናቅቑ');
add('Use this screen to receive payments from customers for credit sales or outstanding balances.', 'ይህን ስክሪን ለደንበኞች ክፍያ ለመቀበል ይጠቀሙ።', 'Iskiriinii kana fayyadami maamilota irraa kaffaltii fudhachuuf.', 'ነዛ ስክሪን ካብ ደንበኛታት ክፍሊት ንምቕባል ተጠቐሙላ።');
add('Search for the customer making the payment. Select them to see their outstanding balance.', 'ክፍያ የሚፈጽመውን ደንበኛ ይፈልጉ። ያልተከፈለ ሂሳባቸውን ለማየት ይምረጡዋቸው።', 'Maamila kaffaltii kana hojjechaa jiru barbaadi. Isaan filadhu haaraa isaanii ilaaluuf.', 'ነቲ ክፍሊት ዝከፍል ደንበኛ ድለዩ። እተረፈ ሂሳቦም ንምርኣይ ምረጹዎም።');
add('Choose which items or invoices the customer is paying for. You can select multiple items.', 'ደንበኛው የሚከፍላቸውን ዕቃዎች ወይም ኢንቮይሶች ይምረጡ። በርካታ ዕቃዎችን መምረጥ ይችላሉ።', 'Meelawwan ykn biilota maamilli kaffaluu filadhu. Meelawwan baayee filachuu dandeessa.', 'እቶም ደንበኛ ዝከፍልዎም እቃታት ወይ ኢንቮይሳት ምረጹ። ብዙሓት እቃታት ክትምርጹ ትኽእሉ ኢኹም።');
add('Enter the amount being paid. The system shows the remaining balance after payment.', 'የሚከፈለውን መጠን ያስገቡ። ሲስተሙ ከክፍያ በኋላ የቀረውን ሂሳብ ያሳያል።', 'Hamma kaffalamuu qabu galchi. Sirni erga kaffaltii booda haaraa agarsiisa.', 'እቲ ዝኽፈል መጠን ኣእትዉ። ሲስተም ድሕሪ ክፍሊት እተረፈ ሂሳብ የርእይ እዩ።');
add('Select how the customer is paying — cash or digital bank transfer.', 'ደንበኛው እንዴት እንደሚከፍል ይምረጡ — በጥሬ ገንዘብ ወይም በዲጂታል የባንክ ዝውውር።', 'Maamilli akka kaffalu filadhu — maallaqaan ykn naannoo baankii dijitaalaan.', 'ደንበኛ ከመይ ከም ዝከፍል ምረጹ — ብገንዘብ ወይ ብዲጂታል ምዝውዋር ባንክ።');
add('Review the payment details and tap to confirm. The payment will be recorded and the balance updated.', 'የክፍያ ዝርዝሮችን ይከልሱ እና ለማረጋገጥ ይንኩ። ክፍያው ይመዘገባል እና ሂሳቡ ይዘምናል።', 'Ibsa kaffaltii ilaali fi mirkaneessuuf tuqi. Kaffaltiin ni galmeeffama; haaraan ni haaromfama.', 'ዝርዝራት ክፍሊት ምርምሩ ከምኡውን ንምርግጋጽ ጠውቑ። ክፍሊት ክምዝገብ ከምኡውን ሂሳብ ክምዕረ እዩ።');

// Contact Details
add('Contact Details', 'የዕውቅት ዝርዝሮች', 'Ibsa Qunnamtii', 'ዝርዝራት ርክብ');
add('View and manage a contact', 'ዕውቅትን ይመልከቱ እና ያስተዳድሩ', 'Qunnamtii ilaali fi bulchi', 'ርክብ ርአዩ ከምኡውን ኣመሓድሩ');
add('Contact Profile', 'የዕውቅት መገለጫ', 'Pirootayilii Qunnamtii', 'መግለጺ ርክብ');
add('Contact Information', 'የዕውቅት መረጃ', 'Odeeffannoo Qunnamtii', 'ሓበሬታ ርክብ');
add('Outstanding Balance', 'ያልተከፈለ ሂሳብ', 'Haaraa Kaffalamuu Hin Qabne', 'እተረፈ ሂሳብ');
add('Actions', 'ድርጊቶች', 'Gochiiwwan', 'ተግባራት');
add('This screen shows all information about a contact — personal details, transaction history, and balances.', 'ይህ ስክሪን ስለ ዕውቅት ሁሉንም መረጃ ያሳያል — የግል ዝርዝሮች፣ የግብይት ታሪክ እና ሂሳቦች።', 'Iskiriinii kun waaee qunnamtii odeeffannoo hunda agarsiisa — ibsa dhuunfaa, seenaa jijjiiramaa, fi haaraa.', 'እዛ ስክሪን ብዛዕባ ርክብ ኩሉ ሓበሬታ ተርኢ — ዝርዝራት ብሕቲ፣ ታሪኽ ልውውጥ ከምኡውን ሂሳባት።');
add('View name, phone numbers, account number, category, and notes.', 'ስም፣ ስልክ ቁጥሮች፣ አካውንት ቁጥር፣ ምድብ እና ማስታወሻዎችን ይመልከቱ።', 'Maqaa, lakkoofsa bilbilaa, lakkoofsa herregaa, ramaddii, fi yaadannoo ilaali.', 'ስም፣ ቁጽርታት ተሌፎን፣ ቁጽሪ ኣካውንት፣ መደብ ከምኡውን ምልክታት ርአዩ።');
add('Any outstanding credit balance for this contact. Track what they owe and when payments are due.', 'ለዚህ ዕውቅት ማንኛውም ያልተከፈለ የብድር ሂሳብ። የሚከፍሉትን እና የክፍያ ቀናትን ይከታተሉ።', 'Qunnamtii kanaaf haaraan liqii kaffalamuu hin qabne. Waan faayaa fi guyyaa kaffaltii hordofi.', 'ንዚ ርክብ እተረፈ ሂሳብ ብድሪ። እንዝከፍልዎን ዕለታት ክፍሊትን ክታበሉ።');
add('Edit contact details, record a sale, or collect payment directly from this screen.', 'የዕውቅት ዝርዝሮችን ያስተካክሉ፣ ሽያጭ ይመዝግቡ፣ ወይም ከዚህ ስክሪን በቀጥታ ክፍያ ይሰብስቡ።', 'Ibsa qunnamtii sirreeffadhu, gurgurtaa galmeessi, ykn iskiriinii kana irraa kaffaltii funyaanuu.', 'ዝርዝራት ርክብ ኣተኻኽሉ፣ ሽያጥ መዝግቡ፣ ወይ ካብዛ ስክሪን ብቐጥታ ክፍሊት እከቡ።');

// Contacts
add('Contacts', 'ዕውቅቶች', 'Qunnamtoota', 'ርክባት');
add('Business Contacts', 'የንግድ ዕውቅቶች', 'Qunnamtii Daldalaa', 'ርክባት ንግዲ');
add('Add a Contact', 'ዕውቅት ያክሉ', 'Qunnamtii Idaati', 'ርክብ ወስኹ');
add('Contact List', 'የዕውቅት ዝርዝር', 'Tarree Qunnamtii', 'ዝርዝር ርክባት');
add('Search Contacts', 'ዕውቅቶችን ይፈልጉ', 'Qunnamtii Barbaadi', 'ርክባት ድለዩ');
add('Manage your business network', 'የንግድ አውታርዎን ያስተዳድሩ', 'Sammuu daldalaa kee bulchi', 'ኔትወርክ ንግድኩም ኣመሓድሩ');
add('Store and manage all your business contacts — customers, suppliers, and partners.', 'ሁሉንም የንግድ ዕውቅቶችዎን ያከማቹ እና ያስተዳድሩ — ደንበኞች፣ አቅራቢዎች እና አጋሮች።', 'Qunnamttoota daldalaa kee hunda kuusi fi bulchi — maamila, dhiyeessota, fi hirmattota.', 'ኩሎም ርክባት ንግድኩም ኣከማችቱ ከምኡውን ኣመሓድሩ — ደንበኛታት፣ ኣቕራቢታት ከምኡውን መሳርሕቲ።');
add('Tap to add a new contact. Enter their name, phone, email, and category.', 'አዲስ ዕውቅት ለመጨመር ይንኩ። ስም፣ ስልክ፣ ኢሜይል እና ምድብ ያስገቡ።', 'Tuqi qunnamtii haaraa idaasuuf. Maqaa, lakkoofsa bilbilaa, iimeelii, fi ramaddii galchi.', 'ሓድሽ ርክብ ንምውስኽ ጠውቑ። ስም፣ ተሌፎን፣ ኢመይል ከምኡውን መደብ ኣእትዉ።');
add('All your contacts displayed here. Search by name or phone, tap for details.', 'ሁሉም ዕውቅቶችዎ እዚህ ይታያሉ። በስም ወይም በስልክ ይፈልጉ፣ ለዝርዝር ይንኩ።', 'Qunnamttoota kee hundinuu asitti mulatu. Maqaan ykn bilbilaan barbaadi, ibsaf tuqi.', 'ኩሎም ርክባትኩም ኣብዚ ይርአዩ። ብስም ወይ ብተሌፎን ድለዩ፣ ንዝርዝር ጠውቑ።');
add('Find any contact instantly by typing their name or phone number.', 'ማንኛውንም ዕውቅት ስም ወይም ስልክ በመተየብ በፍጥነት ይፈልጉ።', 'Qunnamtii kamayyuu maqaa ykn lakkoofsa bilbilaa barreessuun battaluma argadhu.', 'ስም ወይ ቁጽሪ ተሌፎን ብምጽሓፍ ዝኾነ ርክብ ብቐልጡፍ ድለዩ።');

// Dashboard
add('Dashboard', 'ዳሽቦርድ', 'Daashboordii', 'ዳሽቦርድ');
add('Master your business at a glance', 'ንግድዎን በአንድ እይታ ይቆጣጠሩ', 'Daldala kee mala tokkootiin bulchi', 'ንግድኩም ብሓደ ኣረኣእያ ተቆጻጸሩ');
add('Welcome to Your Dashboard', 'እንኳን ወደ ዳሽቦርድዎ በደህና መጡ', 'Daashboordii kee barbaachisaa', 'እንቋዕ ናብ ዳሽቦርድኩም ብደሓን መጻእኩም');
add('Quick Status Cards', 'ፈጣን የሁኔታ ካርዶች', 'Kaardii Sadarkaa Daddafaa', 'ቅልጡፍ ካርዳት ኩነት');
add('Performance Metrics', 'የአፈጻጸም መለኪያዎች', 'Madaalii Hojiivetii', 'መለክዒታት ንጥፈት');
add('Universal Search', 'ሁለንተናዊ ፍለጋ', 'Barbaaduu Waliigalaa', 'ምድላይ ዓለምለኻዊ');
add('Action Alerts', 'የድርጊት ማንቂያዎች', 'Riccati Gochii', 'መጠንቀቕታ ተግባር');
add('Recent Activity Feed', 'የቅርብ ጊዜ እንቅስቃሴ መግብ', 'Sochii Yeroo Dhihoo Feedii', 'መጋብ ንጥፈታት ቀረባ ግዜ');
add('Business Health Score', 'የንግድ ጤና ውጤት', 'Qabxii Fayyaa Daldalaa', 'ነጥቢ ጥዕና ንግዲ');
add('Profile & Navigation', 'መገለጫ እና አሰሳ', 'Pirootayilii fi Qajeelfama', 'መግለጺን ምምራሕን');
add('At-a-glance status of low stock items, credit customers, and pending alerts.', 'ዝቅተኛ ክምችት፣ የብድር ደንበኞች እና የተከማቹ ማንቂያዎች ሁኔታ በፍጥነት ይመልከቱ።', 'Sadarkaa ariifachiisaa meelawwan kuusaa gadi buusan, maamila liqii, fi riccatiwwan eegan.', 'ኩነት ዝተረፈ ክምችት፣ ብድሪ ደንበኛታት ከምኡውን እተጠበቁ መጠንቀቕታት ብቕልጡፍ ርአዩ።');
add('Search across all your inventory, sales, expenses, and contacts from one place.', 'ከአንድ ቦታ በሁሉም ክምችት፣ ሽያጭ፣ ወጪ እና ዕውቅቶች ውስጥ ይፈልጉ።', 'Kuusaa, gurgurtaa, baasii, fi qunnamtii kee hunda keessaa bakka tokkootti barbaadi.', 'ካብ ሓደ ቦታ ኣብ ኩሉ ክምችት፣ ሽያጥ፣ ወጻኢ ከምኡውን ርክባት ድለዩ።');
add('Tap the bell to open your notifications — low stock items, overdue debts, and other urgent updates.', 'ማንቂያ ደወሉን ይንኩ ማንቂያዎችዎን ለመክፈት — ዝቅተኛ ክምችት፣ ያልተከፈሉ ዕዳዎች እና ሌሎች አስቸኳይ ዝመኖች።', 'Bilbila tuqi beekkonsa kee banuuf — meelawwan kuusaa gadi buusan, liqii yeroo isaa darbe, fi haaromsa beelawoo biroo.', 'መጠንቀቕታ ደወል ጠውቑ መጠንቀቕታታትኩም ንምኽፋት — ዝተረፈ ክምችት፣ ዘይተኸፈለ ዕዳታት ከምኡውን ካልኦት ህጹጽ ምምዕባላት።');
add('See a live feed of everything happening in your business — sales, expenses, adjustments.', 'በንግድዎ ውስጥ የሚከሰቱትን ሁሉ የቀጥታ መግብ ይመልከቱ — ሽያጭ፣ ወጪ፣ ማስተካከያዎች።', 'Sochii waaee daldalaa kee hundumaa feedii beelawoo ilaali — gurgurtaa, baasii, sirreeffamoota.', 'ኣብ ንግድኩም ዝኸሱ ኩሉ ቀጥታ መጋብ ርአዩ — ሽያጣት፣ ወጻኢታት፣ ምትእርራያት።');
add('Your overall business health rating based on multiple factors. A higher score means your business is performing well.', 'በበርካታ ምክንያቶች ላይ የተመሰረተ አጠቃላይ የንግድ ጤና ደረጃ። ከፍተኛ ውጤት ማለት ንግድዎ በጥሩ ሁኔታ እየሰራ ነው።', 'Qabxii fayyaa daldalaa guutuu wantoota baayee irratti hundaa. Qabxii ol guddaan daldala kee sirritti hojjechaa jira jechuudha.', 'ኣብ ብዙሓት ምኽንያታት እተመርኰሰ ምሉእ ደረጃ ጥዕና ንግዲ። ልዑል ነጥቢ ማለት ንግድኩም ብጥዕያዊ ምዝራብ ኣሎ።');

// Date & Time Settings
add('Date & Time Settings', 'የቀን እና ሰዓት ቅንብሮች', 'Sajaa Guyyaa fi Saatii', 'ምምሕዳር መዓልትን ሰዓትን');
add('Configure date and time formats', 'የቀን እና ሰዓት ቅርጸቶችን ያዋቅሩ', 'Foormaatiiwwan guyyaa fi saatii qindeessi', 'ቅርጸታት መዓልትን ሰዓትን ኣዋቅሩ');
add('Date & Time', 'ቀን እና ሰዓት', 'Guyyaa fi Saatii', 'መዓልትን ሰዓትን');
add('Calendar Type', 'የቀን አቆጣጠር አይነት', 'Gosa Kalendarii', 'ኣይነት ካላንደር');
add('Time Format', 'የሰዓት ቅርጸት', 'Foormaatii Saatii', 'ቅርጸት ሰዓት');
add('Save Settings', 'ቅንብሮችን አስቀምጥ', 'Sajaa Olkaati', 'ምምሕዳራት ኣቐምጡ');
add('Customize how dates and times are displayed throughout the app.', 'ቀኖች እና ሰዓቶች በመላው መተግበሪያ ውስጥ እንዴት እንደሚታዩ ያብጁ።', 'Appii keessatti guyyaa fi saatoon akka mulatan haala fedheetti jijjiiri.', 'መዓልታትን ሰዓታትን ኣብ መላእ ኣፕሊኬሽን ከመይ ከም ዝርአዩ ብጅዎ።');
add('Choose between Gregorian and Ethiopian calendar systems.', 'በጎርጎርያን እና በኢትዮጵያ የቀን አቆጣጠር ስርዓቶች መካከል ይምረጡ።', 'Sistimii kalendarii Giriigoriyaa fi Itiyoophiyaa gidduu filadhu.', 'ኣብ መንጎ ስርዓት ካላንደር ጎርጎርያዊን ኢትዮጵያዊን ምረጹ።');
add('Select 12-hour or 24-hour time format.', 'የ12-ሰዓት ወይም የ24-ሰዓት ቅርጸት ይምረጡ።', 'Foormaatii saatii 12 ykn 24 filadhu.', 'ቅርጸት ሰዓት 12-ሰዓት ወይ 24-ሰዓት ምረጹ።');
add('Save your date and time preferences. The entire app updates to match.', 'የቀን እና ሰዓት ምርጫዎችዎን ያስቀምጡ። መላው መተግበሪያ ይዘምናል።', 'Filannoowwan guyyaa fi saatii kee olkaati. Appiin guutuun walsimuuf ni haaromfama.', 'ምርጫታት መዓልትን ሰዓትን ኣቐምጡ። መላእ ኣፕሊኬሽን ንምስምማዕ ክምዕር እዩ።');

// Inventory
add('Inventory', 'ክምችት', 'Kuusaa', 'ክምችት');
add('Inventory Vault', 'የክምችት ማከማቻ', 'Kuusaa Kuusaa', 'ክምችት መከማቸታት');
add('Add New Item', 'አዲስ ዕቃ ያክሉ', 'Meelata Haaraa Idaati', 'ሓድሽ ዕቃ ወስኹ');
add('Portfolio Valuation', 'የፖርትፎሊዮ ዋጋ', 'Hamma Maallaqaa Kuusaa', 'ዋጋ ፖርትፎሊዮ');
add('Stock Ledger', 'የክምችት መዝገብ', 'Galmee Kuusaa', 'መዝገብ ክምችት');
add('Item Cards', 'የዕቃ ካርዶች', 'Kaardii Meelataa', 'ካርዳት ዕቃ');
add('Inventory Insights', 'የክምችት ግንዛቤዎች', 'Hubannoo Kuusaa', 'ምስትውዓል ክምችት');
add('Restock Items', 'ዕቃዎችን መልሱ', 'Meelawwan Irra deebii Guuti', 'እቃታት ዳግማይ ኣከማችቱ');
add('Manage your stock efficiently', 'ክምችትዎን በብቃት ያስተዳድሩ', 'Kuusaa kee qajeelfamaan bulchi', 'ክምችትኩም ብትኽክል ኣመሓድሩ');
add('Your complete inventory management system. Track stock levels and manage every item.', 'የተሟላ የክምችት አስተዳደር ስርዓትዎ። የክምችት ደረጃዎችን ይከታተሉ እና እያንዳንዱን ዕቃ ያስተዳድሩ።', 'Sirna bulchiinsa kuusaa kee guutuu. Sadarkaa kuusaa hordofi fi meelata hunda bulchi.', 'ምሉእ ስርዓት ምሕደራ ክምችትኩም። ደረጃታት ክምችት ክታበሉ ከምኡውን ነፍሲ ወከፍ ዕቃ ኣመሓድሩ።');
add('Tap here to add a new product. Fill in the name, category, quantity, and prices.', 'አዲስ ምርት ለመጨመር እዚህ ይንኩ። ስም፣ ምድብ፣ ብዛት እና ዋጋዎች ይሙሉ።', 'As tuqi oomishaa haaraa idaasuuf. Maqaa, ramaddii, hamma, fi gatii guuti.', 'ሓድሽ ምርት ንምውስኽ ኣብዚ ጠውቑ። ስም፣ መደብ፣ ብዝሒ ከምኡውን ዋጋታት መሊእኩም።');
add('See the total value of your inventory. This updates automatically as you add, sell, or adjust items.', 'የክምችትዎን አጠቃላይ ዋጋ ይመልከቱ። ዕቃዎችን ሲጨምሩ፣ ሲሸጡ ወይም ሲያስተካክሉ በራስ-ሰር ይዘምናል።', 'Hamma maallaqaa kuusaa kee ilaali. Yeroo meelawwan idaattu, gurgurtu, ykn sirreessu ofumaan ni haaromfama.', 'ምሉእ ዋጋ ክምችትኩም ርአዩ። እቃታት ክትወስኹ፣ ክትሸጡ ወይ ክተኻኽሉ ከለኹም ብርእሱ ይምዕር እዩ።');
add('All your inventory items listed here. Use the search bar to find items by category or sort.', 'ሁሉም የክምችት ዕቃዎች እዚህ ተዘርዝረዋል። ዕቃዎችን በምድብ ለማግኘት የፍለጋ አሞሌ ይጠቀሙ።', 'Meelawwan kuusaa kee hundinuu asitti tarreefaman. Meelawwan ramaddiidhaan barbaaduuf baara barbaaduu fayyadami.', 'ኩሎም እቃታት ክምችትኩም ኣብዚ ተዘርዚሮም ኣለዉ። እቃታት ብመደብ ንምርካብ መስመር ምድላይ ተጠቐሙ።');
add('Each card shows the item name, current stock, selling price, and unit.', 'እያንዳንዱ ካርድ የዕቃውን ስም፣ የአሁን ክምችት፣ የሽያጭ ዋጋ እና አሃድ ያሳያል።', 'Kaardii tokkoon tokkoon maqaa meelataa, kuusaa ammaa, gatii gurgurtaa, fi unitii agarsiisa.', 'ነፍሲ ወከፍ ካርድ ስም ዕቃ፡ ህሉው ክምችት፡ ዋጋ ሽያጥ ከምኡውን ኣሃዱ የርእይ እዩ።');
add('View stock distribution by category, see low-stock alerts, and monitor expiration dates.', 'ስቶክ በምድብ ሲታይ፣ ዝቅተኛ የስቶክ ማንቂያዎችን ይመልከቱ እና የማለቂያ ቀኖችን ይቆጣጠሩ።', 'Qoodinsa kuusaa ramaddiidhaan ilaali, balaa kuusaa gadi buusaa ilaali, fi guyyaa dhumaa toachadhu.', 'ምብራህ ክምችት ብመደብ ርአዩ፡ መጠንቀቕታታት ዝተረፈ ክምችት ርአዩ ከምኡውን ዕለታት ምውዳእ ተቆጻጸሩ።');
add('When stock runs low, tap to open the product order modal to replenish your inventory.', 'ክምችት ሲያንስ ምርቶችን ለማዘዝ ሞዳሉን ለመክፈት ይንኩ።', 'Yeroo kuusaan gadi buhe, oomishaa ajajuu modal banuuf tuqi kuusaa kee guutuuf.', 'ክምችት ምስ ተንከሰ ምርታት ንምእዳው ሞዳል ንምኽፋት ጠውቑ።');

// === Remaining pure English entries (batch 1: tech terms + titles) ===
add('Excel', 'Excel', 'Excel', 'Excel');
add('PDF', 'PDF', 'PDF', 'PDF');
add('50,000', '50,000', '50,000', '50,000');
add('DD/MM/YYYY', 'DD/MM/YYYY', 'DD/MM/YYYY', 'DD/MM/YYYY');
add('YYYY-MM-DD', 'YYYY-MM-DD', 'YYYY-MM-DD', 'YYYY-MM-DD');
add('CSV / Excel (.csv)', 'CSV / Excel (.csv)', 'CSV / Excel (.csv)', 'CSV / Excel (.csv)');
add('Review all price and stock adjustments', 'ሁሉንም የዋጋ እና የክምችት ማስተካከያዎች ይከልሱ', 'Sirreeffama gatii fi kuusaa hunda ilaali', 'ኩሎም ምትእርራያት ዋጋን ክምችትን ምርምሩ');
add('Set up a spending plan', 'የወጪ እቅድ ያዘጋጁ', 'Karoora baasii qindeessi', 'መደብ ወጻኢ ኣዘጋጅሉ');
add('Place a customer order', 'የደንበኛ ትእዛዝ ያስገቡ', 'Ajaja maamila galchi', 'ትእዛዝ ደንበኛ ኣእትዉ');
add('Record inventory damage or loss', 'የክምችት ጉዳት ወይም ኪሳራ ይመዝግቡ', 'Miidhaa ykn hoongoo kuusaa galmeessi', 'ጉድኣት ወይ ምጥፋእ ክምችት መዝግቡ');
add('Find Item', 'ዕቃ ይፈልጉ', 'Meelata Barbaadi', 'ዕቃ ድለዩ');
add('Record Loss', 'ኪሳራ ይመዝግቡ', 'Hoongoo Galmeessi', 'ምጥፋእ መዝግቡ');
add('Track credit and payments', 'ብድር እና ክፍያዎችን ይከታተሉ', 'Liqii fi kaffaltiiwwan hordofi', 'ብድርን ክፍሊታትን ክታበሉ');
add('View all debt entries', 'ሁሉንም የዕዳ ግቤቶች ይመልከቱ', 'Galmee liqii hunda ilaali', 'ኩሎም መዝገባት ዕዳ ርአዩ');
add('Track credits and collections', 'ብድሮችን እና ስብስቦችን ይከታተሉ', 'Liqiiwwan fi funaansa hordofi', 'ብድራትን ኣከባብርን ክታበሉ');
add('Collect & Pay', 'ሰብስብ እና ክፈል', 'Funyaanuu fi Kaffali', 'እከብ እና ክፈል');
add('Review an expense record', 'የወጪ መዝገብ ይከልሱ', 'Galmee baasii ilaali', 'መዝገብ ወጻኢ ምርምሩ');
add('Log a business expense step by step', 'የንግድ ወጪን ደረጃ በደረጃ ይመዝግቡ', 'Baasii daldalaa tarkaanfataan tarkaanfataan galmeessi', 'ወጻኢ ንግዲ ደረጃ ብደረጃ መዝግቡ');
add('Track financial losses', 'የገንዘብ ኪሳራዎችን ይከታተሉ', 'Hoongoowwan maallaqaa hordofi', 'ምጥፋኣት ገንዘብ ክታበሉ');
add('Loss Tracking', 'የኪሳራ ክትትል', 'Hoongoo Hordofuu', 'ምክትታል ምጥፋእ');
add('Loss Entries', 'የኪሳራ ግቤቶች', 'Galmee Hoongoo', 'መዝገባት ምጥፋእ');
add('View stock movement history', 'የክምችት እንቅስቃሴ ታሪክ ይመልከቱ', 'Seenaa sochii kuusaa ilaali', 'ታሪኽ ምንቅስቓስ ክምችት ርአዩ');
add('Filter Records', 'መዝገቦችን አጣራ', 'Galmee Calleessii', 'መዝገባት ኣጣርሩ');
add('View complete inventory item information', 'ሙሉ የክምችት ዕቃ መረጃ ይመልከቱ', 'Odeeffannoo meelata kuusaa guutuu ilaali', 'ምሉእ ሓበሬታ ዕቃ ክምችት ርአዩ');
add('Quick Actions', 'ፈጣን ድርጊቶች', 'Gochii Daddafaa', 'ቅልጡፍ ተግባራት');
add('Configure your alerts', 'ማንቂያዎችዎን ያዋቅሩ', 'Riccatiwwan kee qindeessi', 'መጠንቀቕታታትኩም ኣዋቅሩ');
add('Stay informed about your business', 'ስለ ንግድዎ እውቀት ይኑርዎ', 'Waaee daldala kee beekkofuu', 'ብዛዕባ ንግድኩም ኣፍልጦ ሃብሉ');
add('Review a purchase order', 'የግዢ ትእዛዝ ይከልሱ', 'Ajaja bitaa ilaali', 'ትእዛዝ ግዢ ምርምሩ');
add('Manage customer orders', 'የደንበኛ ትእዛዞችን ያስተዳድሩ', 'Ajaja maamila bulchi', 'ትእዛዛት ደንበኛ ኣመሓድሩ');
add('Protect your account', 'አካውንትዎን ይጠብቁ', 'Herrega kee eegi', 'ኣካውንትኩም ጠብቁ');
add('Security', 'ደህንነት', 'Nageenya', 'ደህንነት');
add('Biometric Auth', 'ባዮሜትሪክ ማረጋገጫ', 'Biometric Mirkaneessa', 'ባዮሜትሪክ ምርግጋጽ');
add('Get help and app information', 'እርዳታ እና የመተግበሪያ መረጃ ያግኙ', 'Gargaarsa fi odeeffannoo appii argadhu', 'ሓገዝን ሓበሬታ ኣፕሊኬሽንን ርኸቡ');
add('FAQ & Guides', 'FAQ እና መመሪያዎች', 'FAQ fi Qajeelfama', 'FAQን መምርሕታትን');
add('Choose your preferred language', 'የሚመርጡትን ቋንቋ ይምረጡ', 'Afaan filattuu kee filadhu', 'እትመርጽዎ ቋንቋ ምረጹ');
add('Current Language', 'አሁን ያለው ቋንቋ', 'Afaan Ammaa', 'ህሉው ቋንቋ');
add('Warehouse Manager', 'የመጋዘን አስተዳዳሪ', 'Bulchaa Kuusaa', 'ሓላፊ መከማቸታት');
add('Manage your storage locations', 'የማከማቻ ቦታዎችዎን ያስተዳድሩ', 'Bakka kuusaa kee bulchi', 'ቦታታት መከማቸታትኩም ኣመሓድሩ');
add('Warehouse Management', 'የመጋዘን አስተዳደር', 'Bulchiinsa Kuusaa', 'ምሕደራ መከማቸታት');
add('Warehouse List', 'የመጋዘን ዝርዝር', 'Tarree Kuusaa', 'ዝርዝር መከማቸታት');
add('Configure storage locations', 'የማከማቻ ቦታዎችን ያዋቅሩ', 'Bakka kuusaa qindeessi', 'ቦታታት መከማቸታት ኣዋቅሩ');
add('Default Warehouse', 'ነባሪ መጋዘን', 'Kuusaa Durtii', 'ነባሪ መከማቸታት');
add('Transfer Preferences', 'የዝውውር ምርጫዎች', 'Filannoo Daddarbaa', 'ምርጫታት ምዝውዋር');
add('Your Profile', 'መገለጫዎ', 'Pirootayilii Kee', 'መግለጺኻ');
add('Profile Photo', 'የመገለጫ ፎቶ', 'Suuraa Pirootayilii', 'ስእሊ መግለጺ');
add('Track your reminders', 'ማስታወሻዎችዎን ይከታተሉ', 'Yaadannoo kee hordofi', 'ኣማዕሚንታትኩም ክታበሉ');
add('Record a Sale', 'ሽያጭ ይመዝግቡ', 'Gurgurtaa Galmeessi', 'ሽያጥ መዝግቡ');
add('Recording a Sale', 'ሽያጭ በመመዝገብ ላይ', 'Gurgurtaa Galmeessuu', 'ሽያጥ ይመዝገብ ኣሎ');
add('Review a completed transaction', 'የተጠናቀቀ ግብይት ይከልሱ', 'Jijjiirama xumurame ilaali', 'እተወድአ ልውውጥ ምርምሩ');
add('Transaction Details', 'የግብይት ዝርዝሮች', 'Ibsa Jijjiiramaa', 'ዝርዝራት ልውውጥ');
add('Pricing Breakdown', 'የዋጋ ትንተና', 'Qoodinsa Gatii', 'ምብራህ ዋጋ');
add('Transaction List', 'የግብይት ዝርዝር', 'Tarree Jijjiiramaa', 'ዝርዝር ልውውጣት');
add('Export Records', 'መዝገቦችን ይላኩ', 'Galmee Expoortii', 'መዝገባት ላኡ');
add('Manufacturer / Brand', 'አምራች / ብራንድ', 'Oomishaa / Moggaa', 'ኣምራሺ / ብራንድ');
add('Expiration & Quality', 'ማለቂያ ጊዜ እና ጥራት', 'Yeroo Xumuraa fi Qulqullina', 'እዋን ምውዳእን ትሕዝቶን');
// Batch 3: descriptive entries
add('Enter the supplier or company name for this item. This is useful for tracking which vendor supplies the product.', 'ለዚህ ዕቃ የአቅራቢውን ወይም የኩባንያውን ስም ያስገቡ። ይህ የትኛው አቅራቢ ምርቱን እንደሚያቀርብ ለመከታተል ይጠቅማል።', 'Maqaa dhiyeessaa ykn kaampaanii meelata kanaaf galchi. Kun dhiyeessaan kam oomishaa kennu hordofuuf fayya.', 'ስም ኣቕራቢ ወይ ኩባንያ ንዛ ዕቃ ኣእትዉ። እዚ ዝኾነ ኣቕራቢ እቲ ምርት ከም ዝምርህ ንምክትታል ይጠቅም እዩ።');
add('Each entry shows the item name, adjustment type, old and new values, reason, and the user who made the change.', 'እያንዳንዱ ግቤት የዕቃውን ስም፣ የማስተካከያ አይነት፣ የቆዩ እና አዳዲስ እሴቶች፣ ምክንያት እና ለውጡን ያደረገውን ተጠቃሚ ያሳያል።', 'Galmee tokkoon tokkoon maqaa meelataa, gosa sirreeffamaa, gatii dullaa fi haaraa, sababa, fi fayyadamaa jijjiirama hojjete agarsiisa.', 'ነፍሲ ወከፍ መዝገብ ስም ዕቃ፡ ኣይነት ምትእርራይ፡ ኣረንጓይን ሓድሽ ክብረታት፡ ምኽንያት ከምኡውን ነቲ ምቕያር ዝገበረ ተጠቃሚ የርእይ እዩ።');
add('Choose the budget type — business-wide, department-specific, or project-based. This determines how spending is tracked.', 'የበጀት አይነት ይምረጡ — በንግድ-ሙሉ፣ በዲፓርትመንት-ተኮር፣ ወይም በፕሮጀክት-ተኮር። ይህ ወጪ እንዴት እንደሚከታተል ይወስናል።', 'Gosa baajetaa filadhu — daldala-guuftuu, mmf-qilee, ykn pirojekti-qilee. Kun baasii akka hordofamu murteessa.', 'ኣይነት በጀት ምረጹ — ብምሉእ ንግዲ፡ ብክፍሊ-ተኽእሎ ወይ ብፕሮጀክት-ተኽእሎ። እዚ ወጻኢ ከመይ ከም ዝክታበል ይውስን እዩ።');
add('Review your budget settings and confirm. The budget will be active immediately and track expenses in real-time.', 'የበጀት ቅንብሮችዎን ይከልሱ እና ያረጋግጡ። በጀቱ ወዲያውኑ ስራ ላይ ይውላል እና ወጪዎችን በቅጽበት ይከታተላል።', 'Sajaa baajeta kee ilaali fi mirkaneessi. Baajettiin battaluma hojiirra ni oola; baasiiwwan dhugaa yeroo keessatti hordofa.', 'ምምሕዳራት በጀትኩም ምርምሩ ከምኡውን ኣረጋግጹ። በጀቱ ብቕጽበት ኣብ ስራሕ ይእቱ ከምኡውን ወጻኢታት ብናይ ሓቂ ግዜ ይክታበል እዩ።');
add('Review the order summary and tap the commit button to finalize. The order will appear in your orders list.', 'የትእዛዝ ማጠቃለያ ይከልሱ እና ለማጠናቀቅ የማረጋገጫ ቁልፉን ይንኩ። ትእዛዙ በትእዛዞች ዝርዝርዎ ውስጥ ይታያል።', 'Guduunfaa ajajaa ilaali fi battalummaan xumuruuf tuqi. Ajajaan tarree ajajaa kee keessatti ni mulata.', 'ጠቕላላ ትእዛዝ ምርምሩ ንምዝዛም ነጥቢ ምርግጋጽ ጠውቑ። እቲ ትእዛዝ ኣብ ዝርዝር ትእዛዛትኩም ክርአ እዩ።');
add('This screen shows the complete details of a debt or credit account — what was borrowed, payments made, and remaining balance.', 'ይህ ስክሪን የዕዳ ወይም የብድር ሂሳብ ሙሉ ዝርዝሮችን ያሳያል — የተበደረውን፣ የተከፈለውን እና የቀረውን ሂሳብ።', 'Iskiriiniin kun ibsa guutuu herrega liqii ykn liqii agarsiisa — wanti liqeefame, kaffaltiiwwan, fi haaraan hafe.', 'እዛ ስክሪን ምሉእ ዝርዝራት ሂሳብ ዕዳ ወይ ብድሪ ተርኢ — እተለቅሐ፡ እተኸፈለ ከምኡውን እተረፈ ሂሳብ።');
add('View total debt, amount paid, and outstanding balance. The progress bar shows how much has been repaid.', 'ጠቅላላ ዕዳ፣ የተከፈለ መጠን እና ያልተከፈለ ሂሳብ ይመልከቱ። የሂደት አሞሌው ምን ያህል እንደተከፈለ ያሳያል።', 'Liqii waliigalaa, hamma kaffalame, fi haaraa ilaali. Baara adeemsaa meeqa akka kaffalame agarsiisa.', 'ጠቕላላ ዕዳ፡ እተኸፈለ መጠን ከምኡውን እተረፈ ሂሳብ ርአዩ። እቲ ምልክት ሂደት ክንደይ ከም እተኸፈለ የርእይ እዩ።');
add('Details about the original transaction, interest rate (if any), due date, and the customer or vendor involved.', 'ስለ ዋናው ግብይት፣ የወለድ መጠን (ካለ)፣ የክፍያ ቀን እና የተሳተፈው ደንበኛ ወይም አቅራቢ ዝርዝሮች።', 'Ibsa waaee jijjiirama jalqabaa, rate liqii (yoo jiraate), guyyaa kaffaltii, fi maamila ykn dhiyeessa hirmaate.', 'ዝርዝራት ብዛዕባ መበቈል ልውውጥ፡ መጠን ወለድ (እንተሎ)፡ ዕለት ክፍሊት ከምኡውን እቲ ተሳታፊ ደንበኛ ወይ ኣቕራቢ።');
add('Chronological list of all payments made against this debt, including dates, amounts, and payment methods.', 'በዚህ ዕዳ ላይ የተከፈሉ ሁሉም ክፍያዎች የጊዜ ቅደም ተከተል ዝርዝር፣ ቀኖችን፣ መጠኖችን እና የክፍያ ዘዴዎችን ጨምሮ።', 'Tarree yeroo kaffaltiiwwan liqii kana irratti hojjetaman hunda, guyyaa, hamma, fi mala kaffaltii dabalatee.', 'ብቅደም ተኸተል ኣብዚ ዕዳ እተኸፈሉ ኩሎም ክፍሊታት ዝርዝር፡ ዕለታት፡ መጠናት ከምኡውን ኣገባብ ክፍሊት ዘጠቓልል።');
add('Record a new payment against this debt, or mark it as fully settled.', 'በዚህ ዕዳ ላይ አዲስ ክፍያ ይመዝግቡ፣ ወይም ሙሉ በሙሉ እንደተከፈለ ምልክት ያድርጉ።', 'Kaffaltii haaraa liqii kana irratti galmeessi, ykn guutummaatti kaffalameetti mullisi.', 'ኣብዚ ዕዳ ሓድሽ ክፍሊት መዝግቡ፡ ወይ ብምሉኡ እተኸፈለ ምልክት ግበሩ።');
add('View all debt and credit records. This includes both receivables (customers owe you) and payables (you owe suppliers).', 'ሁሉንም የዕዳ እና የብድር መዝገቦች ይመልከቱ። ይህ ሁለቱንም የሚከፈልዎትን (ደንበኞች ዕዳ አለባቸው) እና የሚከፍሉትን (ለአቅራቢዎች ዕዳ አለብዎት) ያካትታል።', 'Galmee liqii fi liqii hunda ilaali. Kun hoji-qoruu (maamilli siif haara) fi liqiiwwan (ati dhiyeessotaa liqeessa) lamaanuu dabalata.', 'ኩሎም መዝገባት ዕዳን ብድርን ርአዩ። እዚ ክልኤቲ ክትቅበልዎ (ደንበኛታት ዕዳ ኣለቦም) ከምኡውን ክትከፍልዎ (ንኣቕራቢታት ዕዳ ኣለኩም) ዘጠቓልል እዩ።');
add('See total receivables (customers owe you) and total payables (you owe suppliers) at a glance.', 'በአንድ እይታ ጠቅላላ የሚከፈልዎትን (ደንበኞች ዕዳ አለባቸው) እና ጠቅላላ የሚከፍሉትን (ለአቅራቢዎች ዕዳ አለብዎት) ይመልከቱ።', 'Hoji-qoruu waliigalaa (maamilli siif haara) fi liqii waliigalaa (ati dhiyeessotaa liqeessa) mila tokkootiin ilaali.', 'ብሓደ ኣረኣእያ ጠቕላላ እትቕበልዎ (ደንበኛታት ዕዳ ኣለቦም) ከምኡውን ጠቕላላ እትከፍልዎ (ንኣቕራቢታት ዕዳ ኣለኩም) ርአዩ።');
add('Record payments received from customers or make payments to suppliers directly from this screen.', 'ከደንበኞች የተቀበሉትን ክፍያዎች ይመዝግቡ ወይም ለአቅራቢዎች ከዚህ ስክሪን በቀጥታ ይክፈሉ።', 'Kaffaltii maamila irraa fudhatame galmeessi ykn kaffaltii dhiyeessotaa iskiriinii kana irraa kallattiin kaffali.', 'ካብ ደንበኛታት እተቐበልኩምዎ ክፍሊታት መዝግቡ ወይ ንኣቕራቢታት ካብዛ ስክሪን ብቐጥታ ክፈሉ።');
add('Review the full details of an expense transaction including amount, category, date, and payment information.', 'የወጪ ግብይት ሙሉ ዝርዝሮችን ይከልሱ — መጠን፣ ምድብ፣ ቀን እና የክፍያ መረጃን ጨምሮ።', 'Ibsa guutuu jijjiirama baasii hamma, ramaddii, guyyaa, fi odeeffannoo kaffaltii dabalate ilaali.', 'ምሉእ ዝርዝራት ልውውጥ ወጻኢ ምርምሩ — መጠን፡ መደብ፡ ዕለት ከምኡውን ሓበሬታ ክፍሊት ዘጠቓልል።');
add('The expense amount, category, and subcategory. This helps you understand where your money is going.', 'የወጪ መጠን፣ ምድብ እና ንኡስ ምድብ። ይህ ገንዘብዎ ወዴት እንደሚሄድ ለመረዳት ይረዳዎታል።', 'Hamma baasii, ramaddii, fi ramaddii xiqqaa. Kun maallaqni kee eessa akka deemaa hubachuuf si gargaara.', 'መጠን ወጻኢ፡ መደብ ከምኡውን ንኡስ መደብ። እዚ ገንዘብኩም ናበይ ከም ዝኸይድ ንምርዳእ ይሕግዘኩም እዩ።');
add('Follow these steps to log a new expense. Fill in the amount, category, date, and optionally set up recurring payments.', 'አዲስ ወጪ ለመመዝገብ እነዚህን ደረጃዎች ይከተሉ። መጠን፣ ምድብ፣ ቀን ይሙሉ እና አማራጭ ተደጋጋሚ ክፍያዎችን ያዘጋጁ።', 'Tarkaanfiiwwan kana hordofi baasii haaraa galmeessuuf. Hamma, ramaddii, guyyaa guuti, akkasumas filannoodhaan kaffaltiiwwan deddeebi\'an qindeessi.', 'ነዞም ደረጃታት ተኸተሉ ሓድሽ ወጻኢ ንምምዝጋብ። መጠን፡ መደብ፡ ዕለት መሊእኩም ከምኡውን ብምርጫ ዝደጋገሙ ክፍሊታት ኣዘጋጅሉ።');
add('Review all details and tap to record the expense. It will appear in your expense ledger and reports immediately.', 'ሁሉንም ዝርዝሮች ይከልሱ እና ወጪውን ለመመዝገብ ይንኩ። ወዲያውኑ በወጪ መዝገብዎ እና ሪፖርቶች ውስጥ ይታያል።', 'Ibsa hunda ilaali fi baasii galmeessuuf tuqi. Baasiin galmee baasii kee fi gabaalee keessatti battaluma ni mulata.', 'ኩሎም ዝርዝራት ምርምሩ ነቲ ወጻኢ ንምምዝጋብ ጠውቑ። ብቕጽበት ኣብ መዝገብ ወጻኢን ሪፖርታትን ክርአ እዩ።');
add('Each entry shows the amount, category badge, date, and description. Tap any entry to view or edit details.', 'እያንዳንዱ ግቤት መጠን፣ የምድብ ባጅ፣ ቀን እና መግለጫ ያሳያል። ዝርዝሮችን ለማየት ወይም ለማስተካከል ማንኛውንም ግቤት ይንኩ።', 'Galmee tokkoon tokkoon hamma, baaja ramaddii, guyyaa, fi ibsa agarsiisa. Ibsa ilaaluu ykn sirreeffachuuf galmee kamiyyuu tuqi.', 'ነፍሲ ወከፍ መዝገብ መጠን፡ ባጅ መደብ፡ ዕለት ከምኡውን መግለጺ የርእይ እዩ። ዝርዝራት ንምርኣይ ወይ ንምትእርራይ ዝኾነ መዝገብ ጠውቑ።');
add('Each loss entry shows the amount, type, date, and description. Tap for more details about the incident.', 'እያንዳንዱ የኪሳራ ግቤት መጠን፣ አይነት፣ ቀን እና መግለጫ ያሳያል። ስለ ክስተቱ ተጨማሪ ዝርዝሮች ለማግኘት ይንኩ።', 'Galmee hoongoo tokkoon tokkoon hamma, gosa, guyyaa, fi ibsa agarsiisa. Waaee gochaatti ibsa dabalataaf tuqi.', 'ነፍሲ ወከፍ መዝገብ ምጥፋእ መጠን፡ ኣይነት፡ ዕለት ከምኡውን መግለጺ የርእይ እዩ። ብዛዕባ እቲ ኣጋጣሚ ተወሳኺ ዝርዝራት ንምርካብ ጠውቑ።');
add('Every stock movement is listed chronologically with item name, type, quantity change, and resulting balance.', 'እያንዳንዱ የክምችት እንቅስቃሴ በጊዜ ቅደም ተከተል ከዕቃ ስም፣ አይነት፣ የብዛት ለውጥ እና የተገኘው ሂሳብ ጋር ተዘርዝሯል።', 'Sochii kuusaa hunda yeroo tartiibaan maqaa meelataa, gosa, jijjiirama hamma, fi haaraa bu\'aa waliin tarreefame.', 'ነፍሲ ወከፍ ምንቅስቓስ ክምችት ብቅደም ተኸተል ምስ ስም ዕቃ፡ ኣይነት፡ ምቕያር ብዝሒ ከምኡውን እተረፈ ሂሳብ ተዘርዚሩ ኣሎ።');
// Batch 4: remaining descriptions
add('Your complete inventory management system. Track stock levels, monitor valuations, and manage every item in your store.', 'የተሟላ የክምችት አስተዳደር ስርዓትዎ። የክምችት ደረጃዎችን ይከታተሉ፣ ዋጋዎችን ይቆጣጠሩ እና እያንዳንዱን ዕቃ በመደብርዎ ውስጥ ያስተዳድሩ።', 'Sirna bulchiinsa kuusaa kee guutuu. Sadarkaa kuusaa hordofi, madaaliiwwan toachadhu, fi meelata hunda daldala kee keessatti bulchi.', 'ምሉእ ስርዓት ምሕደራ ክምችትኩም። ደረጃታት ክምችት ክታበሉ፡ ዋጋታት ተቆጻጸሩ ከምኡውን ነፍሲ ወከፍ ዕቃ ኣብ መደብርኩም ኣመሓድሩ።');
add('This screen shows everything about an inventory item — stock levels, pricing, supplier info, and movement history.', 'ይህ ስክሪን ስለ ክምችት ዕቃ ሁሉንም ነገር ያሳያል — የክምችት ደረጃዎች፣ ዋጋ አሰጣጥ፣ የአቅራቢ መረጃ እና የእንቅስቃሴ ታሪክ።', 'Iskiriiniin kun waaee meelata kuusaa wantoota hunda agarsiisa — sadarkaa kuusaa, gatii, odeeffannoo dhiyeessaa, fi seenaa sochii.', 'እዛ ስክሪን ብዛዕባ ዕቃ ክምችት ኩሉ ነገር ተርኢ — ደረጃታት ክምችት፡ ዋጋ ኣወጣጥር፡ ሓበሬታ ኣቕራቢ ከምኡውን ታሪኽ ምንቅስቓስ።');
add('Each item shows current stock level, minimum threshold, and supplier information for quick reordering.', 'እያንዳንዱ ዕቃ የአሁን የክምችት ደረጃ፣ ዝቅተኛ ወሰን እና ለፈጣን ትእዛዝ የአቅራቢ መረጃ ያሳያል።', 'Meelata tokkoon tokkoon sadarkaa kuusaa ammaa, daangaa gadi buusaa, fi odeeffannoo dhiyeessaa ajajuu ariifachiisuuf agarsiisa.', 'ነፍሲ ወከፍ ዕቃ ህሉው ደረጃ ክምችት፡ ዝተረፈ ወሰን ከምኡውን ንቅልጡፍ ትእዛዝ ሓበሬታ ኣቕራቢ የርእይ እዩ።');
add('Choose which business notifications you receive. Control alerts for stock, payments, expenses, and more.', 'የሚቀበሏቸውን የንግድ ማሳወቂያዎች ይምረጡ። ለክምችት፣ ክፍያዎች፣ ወጪዎች እና ሌሎች ማንቂያዎችን ይቆጣጠሩ።', 'Beekkonsa daldalaa fudhattu filadhu. Riccatiwwan kuusaa, kaffaltii, baasii, fi kan biroof bulchi.', 'እትቕበልዎም መፍለጢታት ንግዲ ምረጹ። መጠንቀቕታታት ንክምችት፡ ክፍሊታት፡ ወጻኢታት ከምኡውን ካልኦት ተቆጻጸሩ።');
add('Get alerted about large or unusual expenses. Track budget limits and receive warnings when approaching limits.', 'ስለ ትልልቅ ወይም ያልተለመዱ ወጪዎች ማንቂያ ያግኙ። የበጀት ገደቦችን ይከታተሉ እና ወደ ገደብ ሲቃረቡ ማስጠንቀቂያ ይቀበሉ።', 'Waaee baasiiwwan gurguddaa ykn hin baramne beellama argadhu. Daangaa baajetaa hordofi fi yeroo daangaa bira ga\'u akeekkachiisa fudhadhu.', 'ብዛዕባ ዓበይቲ ወይ ዘይተለምደሱ ወጻኢታት መጠንቀቕታ ርኸቡ። ደረታት በጀት ክታበሉ ከምኡውን ናብ ደረት ከትቀርቡ ከለኩም መጠንቀቕታ ተቐበሉ።');
add('View all your business notifications — low stock alerts, payment reminders, expense warnings, and more.', 'ሁሉንም የንግድ ማሳወቂያዎችዎን ይመልከቱ — ዝቅተኛ የክምችት ማንቂያዎች፣ የክፍያ ማስታወሻዎች፣ የወጪ ማስጠንቀቂያዎች እና ሌሎችም።', 'Beekkonsa daldalaa kee hunda ilaali — riccata kuusaa gadi buusaa, yaadannoo kaffaltii, akeekkachiisa baasii, fi kan biroo.', 'ኩሎም መፍለጢታት ንግድኩም ርአዩ — መጠንቀቕታታት ዝተረፈ ክምችት፡ ኣማዕሚንታት ክፍሊት፡ መጠንቀቕታታት ወጻኢ ከምኡውን ካልኦት።');
add('Mark notifications as read, dismiss them, or tap to take action directly (e.g., restock a low inventory item).', 'ማሳወቂያዎችን እንደተነበቡ ምልክት ያድርጉ፣ ያስወግዷቸው፣ ወይም በቀጥታ እርምጃ ለመውሰድ ይንኩ (ለምሳሌ ዝቅተኛ ክምችት ያለው ዕቃን መሙላት)።', 'Beekkonsa dubbifameetti mullisi, ittiin deemi, ykn gochii kallattiidhaan fudhachuuf tuqi (fkn, meelata kuusaa gadi buusaa guuti).', 'ንመፍለጢታት ከም እተነበቡ ምልክት ግበሩ፡ ኣርሕቑዎም፡ ወይ ብቐጥታ ተግባር ንምውሳድ ጠውቑ (ንኣብነት ዝተረፈ ክምችት ዘለዎ ዕቃ መልኡ)።');
add('Track customer orders from creation to fulfillment. Manage order status, quantities, and delivery all in one place.', 'የደንበኛ ትእዛዞችን ከፈጠራ እስከ አፈጻጸም ይከታተሉ። የትእዛዝ ሁኔታ፣ ብዛት እና አቅርቦት በሙሉ በአንድ ቦታ ያስተዳድሩ።', 'Ajaja maamila uumamaa kaasee hojiiwwan hordofi. Haala ajajaa, hamma, fi geejjiba bakka tokkootti bulchi.', 'ትእዛዛት ደንበኛ ካብ ምፍጣር ክሳዕ ምፍጻም ክታበሉ። ኩነት ትእዛዝ፡ ብዝሒ ከምኡውን ኣብ ምድላው ኩሉ ኣብ ሓደ ቦታ ኣመሓድሩ።');
add('See the subtotal, discounts, and grand total for the pending transaction in real-time as you make changes.', 'በለውጦች ላይ እያሉ ለታገደ ግብይት ንዑስ-ድምር፣ ቅናሾች እና አጠቃላይ ድምር በቅጽበት ይመልከቱ።', 'Walxaxaa, hir\'ina, fi waliigala jijjiirama eeguu yeroo dhugaa keessatti jijjiirama hojjettu ilaali.', 'ንእሽቶ-ድምር፡ ቅናሽታት ከምኡውን ጠቕላላ ድምር ንእተጻበየ ልውውጥ ምቕያራት ክትገብሩ ከለኩም ብቕጽበት ርአዩ።');
add('Follow these steps to decrease the selling price of an inventory item. Use this for promotions, clearance, or competitive pricing.', 'የክምችት ዕቃን የሽያጭ ዋጋ ለመቀነስ እነዚህን ደረጃዎች ይከተሉ። ለማስተዋወቂያ፣ ማጽደያ ወይም ተወዳዳሪ ዋጋ አሰጣጥ ይጠቀሙ።', 'Tarkaanfiiwwan kana hordofi gatii gurgurtaa meelata kuusaa hirisuuf. Kun beeksisa, qulqullina, ykn gatii dorgommii fayyadami.', 'ነዞም ደረጃታት ተኸተሉ ዋጋ ሽያጭ ዕቃ ክምችት ንምቕናስ። ንምስታዎቂያ፡ ማጽረያ ወይ ተወዳዳሪ ዋጋ ኣወጣጥር ተጠቐሙ።');
add('Enter the reduced selling price. The system shows the discount amount and updated profit margin.', 'የተቀነሰውን የሽያጭ ዋጋ ያስገቡ። ሲስተሙ የቅናሽ መጠን እና የተዘመነ የትርፍ ህዳግ ያሳያል።', 'Gatii gurgurtaa hir\'ate galchi. Sirni hamma hir\'inaa fi daangaa bu\'aa haarome agarsiisa.', 'እተቐነሰ ዋጋ ሽያጭ ኣእትዉ። ሲስተም መጠን ቅናሽን እተመዓረለ ወሰን ትርፊት የርእይ እዩ።');
add('Enter a reason (e.g., promotion, clearance, competitive match). This is logged in the adjustment history.', 'ምክንያት ያስገቡ (ለምሳሌ ማስተዋወቂያ፣ ማጽደያ፣ ተወዳዳሪ ዋጋ)። ይህ በማስተካከያ ታሪክ ውስጥ ይመዘገባል።', 'Sababa galchi (fkn, beeksisa, qulqullina, dorgommii). Kun seenaa sirreeffama keessatti galmeeffama.', 'ምኽንያት ኣእትዉ (ንኣብነት ምስታዎቂያ፡ ማጽረያ፡ ተወዳዳሪ)። እዚ ኣብ ታሪኽ ምትእርራይ ይምዝገብ እዩ።');
add('Set the date for the new price. The adjustment is recorded in your price history.', 'ለአዲሱ ዋጋ ቀን ያዘጋጁ። ማስተካከያው በዋጋ ታሪክዎ ውስጥ ይመዘገባል።', 'Guyyaa gatii haaraa qindeessi. Sirreeffamni seenaa gatii kee keessatti galmeeffama.', 'ንሓድሽ ዋጋ መዓልቲ ኣዘጋጅሉ። እቲ ምትእርራይ ኣብ ታሪኽ ዋጋኩም ይምዝገብ እዩ።');
add('Review and confirm to apply the price decrease. The selling price updates immediately in your inventory.', 'የዋጋ ቅነሻውን ለመተግበር ይከልሱ እና ያረጋግጡ። የሽያጭ ዋጋው ወዲያውኑ በክምችትዎ ውስጥ ይዘምናል።', 'Ilaali fi mirkaneessi hir\'ina gatii hojiirra ooluuf. Gatiin gurgurtaa battaluma kuusaa kee keessatti ni haaromfama.', 'ንምትግባር ዋጋ ምቕናስ ምርምሩ ከምኡውን ኣረጋግጡ። ዋጋ ሽያጭ ብቕጽበት ኣብ ክምችትኩም ክምዕር እዩ።');
add('Follow these steps to increase the selling price of an inventory item. This helps you adjust to market changes or cost increases.', 'የክምችት ዕቃን የሽያጭ ዋጋ ለመጨመር እነዚህን ደረጃዎች ይከተሉ። ይህ ከገበያ ለውጦች ወይም የዋጋ ጭማሪዎች ጋር ለማስማማት ይረዳዎታል።', 'Tarkaanfiiwwan kana hordofi gatii gurgurtaa meelata kuusaa dabaluuf. Kun jijjiirama gabaa ykn dabalaa baasii walsimsiisuuf si gargaara.', 'ነዞም ደረጃታት ተኸተሉ ዋጋ ሽያጭ ዕቃ ክምችት ንምውሳኽ። እዚ ምስ ምቕያር ገበያ ወይ ምውሳኽ ወጻኢ ንምስምማዕ ይሕግዘኩም እዩ።');
add('Enter the new selling price. The system will show the price difference and calculate the new profit margin.', 'አዲሱን የሽያጭ ዋጋ ያስገቡ። ሲስተሙ የዋጋ ልዩነቱን ያሳያል እና አዲሱን የትርፍ ህዳግ ያሰላል።', 'Gatii gurgurtaa haaraa galchi. Sirni garaagarummaa gatii agarsiisa; daangaa bu\'aa haaraa ni shallaga.', 'ሓድሽ ዋጋ ሽያጭ ኣእትዉ። ሲስተም ፍልልይ ዋጋ የርእይ ከምኡውን ሓድሽ ወሰን ትርፊት የሕስብ እዩ።');
add('Provide a reason for the price increase (e.g., supplier price change, market adjustment, inflation). This is recorded in the adjustment history.', 'ለዋጋ ጭማሪ ምክንያት ያስገቡ (ለምሳሌ የአቅራቢ ዋጋ ለውጥ፣ የገበያ ማስተካከያ፣ የዋጋ ንረት)። ይህ በማስተካከያ ታሪክ ውስጥ ይመዘገባል።', 'Sababa dabalaa gatiif kenni (fkn, jijjiirama gatii dhiyeessaa, sirreeffama gabaa, inflation). Kun seenaa sirreeffamaa keessatti galmeeffama.', 'ንምውሳኽ ዋጋ ምኽንያት ኣብቅዑ (ንኣብነት ምቕያር ዋጋ ኣቕራቢ፡ ምትእርራይ ገበያ፡ ዋጋ ንረት)። እዚ ኣብ ታሪኽ ምትእርራይ ይምዝገብ እዩ።');
add('Set the date when the new price takes effect. The change is logged in the price adjustment history for future reference.', 'አዲሱ ዋጋ ተግባራዊ የሚሆንበትን ቀን ያዘጋጁ። ለውጡ ለወደፊት ማጣቀሻ በዋጋ ማስተካከያ ታሪክ ውስጥ ይመዘገባል።', 'Guyyaa gatii haaraan hojiirra oolu qindeessi. Jijjiiramni seenaa sirreeffama gatii keessatti wabii fuula duraatiif galmeeffama.', 'እቲ ሓድሽ ዋጋ ኣብ ስራሕ ዝኣቱሉ ዕለት ኣዘጋጅሉ። እቲ ምቕያር ንወደፊት ምቹእ መጥቀሲ ኣብ ታሪኽ ምትእርራይ ዋጋ ይምዝገብ እዩ።');
// Batch 5: remaining entries
add('See your total budget, spending to date, and remaining balance. The health indicator shows if you\\\'re on track.', 'ጠቅላላ በጀትዎን፣ እስከ ዛሬ ያወጡትን እና የቀረውን ሂሳብ ይመልከቱ። የጤና አመልካች በትክክል እየተከተሉ እንደሆነ ያሳያል።', 'Baajeta kee walii galaa, baasii har\'aa, fi haaraa hafe ilaali. Mallattoo fayyaa karaa irra jirtu agarsiisa.', 'ጠቕላላ በጀትኩም፡ ክሳዕ ሎሚ እተወጻእኩምዎን እተረፈ ሂሳብን ርአዩ። መለልዒ ጥዕና ብቑዕ ኮይኑ ከም ዝኸዱ የርእይ እዩ።');
add('Enter the amount being paid. The system shows the remaining balance after this payment.', 'የሚከፈለውን መጠን ያስገቡ። ሲስተሙ ከዚህ ክፍያ በኋላ የቀረውን ሂሳብ ያሳያል።', 'Hamma kaffalamuu galchi. Sirni erga kaffaltii kana booda haaraa hafe agarsiisa.', 'እቲ ዝኽፈል መጠን ኣእትዉ። ሲስተም ድሕሪ እዚ ክፍሊት እተረፈ ሂሳብ የርእይ እዩ።');
add('Review the payment details and confirm. The customer\\\'s balance is updated and the transaction is recorded.', 'የክፍያ ዝርዝሮችን ይከልሱ እና ያረጋግጡ። የደንበኛው ሂሳብ ይዘምናል እና ግብይቱ ይመዘገባል።', 'Ibsa kaffaltii ilaali fi mirkaneessi. Herregaan maamila ni haaromfama; jijjiiramni ni galmeeffama.', 'ዝርዝራት ክፍሊት ምርምሩ ከምኡውን ኣረጋግጡ። ሂሳብ ደንበኛ ይምዕር ከምኡውን እቲ ልውውጥ ይምዝገብ እዩ።');
add('Enter the customer\\\'s name or phone to start. Search and select an existing contact or add a new one.', 'ለመጀመር የደንበኛውን ስም ወይም ስልክ ያስገቡ። ያለውን ዕውቅት ይፈልጉ እና ይምረጡ ወይም አዲስ ያክሉ።', 'Maqaa ykn lakkoofsa bilbilaa maamila galchi jalqabuuf. Qunnamtii jiraa barbaadi fi filadhu ykn haaraa idaati.', 'ንምጅማር ስም ወይ ቁጽሪ ተሌፎን ደንበኛ ኣእትዉ። ዘሎ ርክብ ድለዩ ከምኡውን ምረጹ ወይ ሓድሽ ወስኹ።');
add('This is your command center. View today\\\'s summary, key metrics, and recent activity all in one place.', 'ይህ የእርስዎ የትእዛዝ ማዕከል ነው። የዛሬን ማጠቃለያ፣ ቁልፍ መለኪያዎች እና የቅርብ ጊዜ እንቅስቃሴ በሙሉ በአንድ ቦታ ይመልከቱ።', 'Kun waltajjii abboommii kee. Guduunfaa har\'aa, madaaliiwwan ijoo, fi sochii dhihoo hunda bakka tokko ilaali.', 'እዚ ማእከል ትእዛዝኩም እዩ። ጠቕላላ ሎሚ፡ ቀንዲ መለክዒታት ከምኡውን ቀረባ ንጥፈታት ኩሉ ኣብ ሓደ ቦታ ርአዩ።');
add('View the expense date, description, and whether it\\\'s recurring. This helps you track spending patterns.', 'የወጪውን ቀን፣ መግለጫ እና ተደጋጋሚ መሆኑን ይመልከቱ። ይህ የወጪ ልማዶችን ለመከታተል ይረዳዎታል።', 'Guyyaa baasii, ibsa, fi yoo deddeebi\'aa ta\'e ilaali. Kun akkaataa baasii hordofuuf si gargaara.', 'ዕለት ወጻኢ፡ መግለጺ ከምኡውን ዝደጋገም ምዃኑ ርአዩ። እዚ ንምክትታል ልማዳት ወጻኢ ይሕግዘኩም እዩ።');
add('See your total monthly expenses, compare against last month, and track spending categories at a glance.', 'ጠቅላላ ወርሃዊ ወጪዎችዎን ይመልከቱ፣ ካለፈው ወር ጋር ያወዳድሩ እና የወጪ ምድቦችን በአንድ እይታ ይከታተሉ።', 'Baasii jiisaa kee walii galaa ilaali, ji\'a darbe waliin madaali, fi ramaddii baasii mila tokkootiin hordofi.', 'ጠቕላላ ወርሓዊ ወጻኢታትኩም ርአዩ፡ ምስ እተሓለፈ ወር ኣወዳድሩ ከምኡውን መደባት ወጻኢ ብሓደ ኣረኣእያ ክታበሉ።');
add('Every transaction is recorded chronologically. Tap any entry to view or edit details. Swipe to delete if needed.', 'እያንዳንዱ ግብይት በጊዜ ቅደም ተከተል ይመዘገባል። ዝርዝሮችን ለማየት ወይም ለማስተካከል ማንኛውንም ግቤት ይንኩ። አስፈላጊ ከሆነ ወደ ጎን ያንሸራትቱ እና ይሰርዙ።', 'Jijjiiramni hunda yeroo tartiibaan galmeeffama. Ibsa ilaaluu ykn sirreeffachuuf galmee kamiyyuu tuqi. Yoo barbaachise, siigi fi haqi.', 'ነፍሲ ወከፍ ልውውጥ ብቅደም ተኸተል ይምዝገብ እዩ። ዝርዝራት ንምርኣይ ወይ ንምትእርራይ ዝኾነ መዝገብ ጠውቑ። ኣድላዪ እንተኾይኑ ስብልሉ ከምኡውን ኣርሕቁ።');
add('Set a monthly spending limit to control costs. Track your spending against budget in real-time and get alerts when you\\\'re close to the limit.', 'ወጪዎችን ለመቆጣጠር ወርሃዊ የወጪ ገደብ ያዘጋጁ። ወጪዎን ከበጀት ጋር በቅጽበት ይከታተሉ እና ወደ ገደብ ሲቃረቡ ማንቂያ ያግኙ።', 'Baasii toachuuf daangaa jiisaa qindeessi. Baasii kee baajeta waliin yeroo dhugaa hordofi fi yeroo daangaa bira ga\'u beellama argadhu.', 'ወጻኢታት ንምቁጽጻር ወርሓዊ ደረት ወጻኢ ኣዘጋጅሉ። ወጻኢኩም ምስ በጀት ብቕጽበት ክታበሉ ከምኡውን ናብ ደረት ከትቀርቡ ከለኩም መጠንቀቕታ ርኸቡ።');
add('Follow these steps to add a new product to your inventory. You\\\'ll enter the name, category, quantity, pricing, and more.', 'አዲስ ምርት ወደ ክምችትዎ ለመጨመር እነዚህን ደረጃዎች ይከተሉ። ስም፣ ምድብ፣ ብዛት፣ ዋጋ እና ሌሎችን ያስገባሉ።', 'Tarkaanfiiwwan kana hordofi oomishaa haaraa kuusaa keetti idaasuuf. Maqaa, ramaddii, hamma, gatii, fi kan biroo galchita.', 'ነዞም ደረጃታት ተኸተሉ ሓድሽ ምርት ናብ ክምችትኩም ንምውስኽ። ስም፡ መደብ፡ ብዝሒ፡ ዋጋ ከምኡውን ካልእ ከተእትዉ ኢኹም።');
add('Enter the manufacturer or brand name. This is useful for identifying products, especially when dealing with multiple suppliers.', 'የአምራች ወይም የብራንድ ስም ያስገቡ። ይህ ምርቶችን ለመለየት በተለይ ከበርካታ አቅራቢዎች ጋር በሚገናኙበት ጊዜ ጠቃሚ ነው።', 'Maqaa oomishaa ykn moggaa galchi. Kun oomishaalee adda baafachuuf, keessattuu dhiyeessota baayee waliin yeroo hojjettu, fayya.', 'ስም ኣምራሺ ወይ ብራንድ ኣእትዉ። እዚ ምርታት ንምልላይ በተወሳኺ ምስ ብዙሓት ኣቕራቢታት ከተናግሩ ከለኩም ይጠቅም እዩ።');
add('Enter the buying price (cost) and selling price. The system calculates your profit margin automatically and warns if you\\\'re selling at a loss.', 'የግዢ ዋጋ (ወጪ) እና የሽያጭ ዋጋ ያስገቡ። ሲስተሙ የትርፍ ህዳግዎን በራስ-ሰር ያሰላል እና በኪሳራ እየሸጡ ከሆነ ያስጠነቅቃል።', 'Gatii bitaa (baasii) fi gatii gurgurtaa galchi. Sirni daangaa bu\'aa kee ofumaan shallaga; yoo hoongoon gurgurtaa ta\'e si akeekkachiisa.', 'ዋጋ ግዢ (ወጻኢ) ከምኡውን ዋጋ ሽያጭ ኣእትዉ። ሲስተም ወሰን ትርፊትኩም ብርእሱ የሕስብ ከምኡውን ብምጥፋእ እንተትሸጡ የጠንቅቐኩም እዩ።');
add('Review the details and confirm to apply the price increase. The item\\\'s selling price updates immediately.', 'ዋጋ ጭማሪውን ለመተግበር ዝርዝሮቹን ይከልሱ እና ያረጋግጡ። የዕቃው የሽያጭ ዋጋ ወዲያውኑ ይዘምናል።', 'Ilaali fi mirkaneessi dabalaa gatii hojiirra ooluuf. Gatiin gurgurtaa meelataa battaluma ni haaromfama.', 'ንምትግባር ዋጋ ምውሳኽ ዝርዝራት ምርምሩ ከምኡውን ኣረጋግጡ። ዋጋ ሽያጭ እታ ዕቃ ብቕጽበት ክምዕር እዩ።');
add('View all scheduled and past reminders for payments, stock checks, and business tasks.', 'ሁሉንም የታቀዱ እና ያለፉ ማሳሰቢያዎች ለክፍያ፣ የክምችት ቼክ እና የንግድ ተግባራት ይመልከቱ።', 'Yaadannoo karoorfamee fi darbe hunda kaffaltii, sakatta\'a kuusaa, fi hojii daldalaa ilaali.', 'ኩሎም እተዳለዉን ዝሓለፈን ኣማዕሚንታት ንክፍሊት፡ መርመራት ክምችት ከምኡውን ተግባራት ንግዲ ርአዩ።');
add('This list shows every item in the transaction, including quantity, unit price, and subtotal. Tap any item for more details.', 'ይህ ዝርዝር በግብይቱ ውስጥ ያለውን እያንዳንዱን ዕቃ ያሳያል፣ ብዛት፣ የአሃድ ዋጋ እና ንዑስ ድምርን ጨምሮ። ለበለጠ ዝርዝር ማንኛውንም ዕቃ ይንኩ።', 'Tarreewwan kun meelata hunda jijjiirama keessaatti, hamma, gatii unitii, fi walxaxaa dabalatee agarsiisa. Ibsa dabalataaf meelata kamiyyuu tuqi.', 'እዚ ዝርዝር ኣብቲ ልውውጥ ንብዝሒ፡ ዋጋ ኣሃዱ ከምኡውን ንእሽቶ ድምር ዘጠቓለለ ኩሉ ዕቃ የርእይ እዩ። ንተወሳኺ ዝርዝራት ዝኾነ ዕቃ ጠውቑ።');
add('Each entry shows the date, customer, item count, total amount, and payment status. Tap any entry for full details.', 'እያንዳንዱ ግቤት ቀን፣ ደንበኛ፣ የዕቃ ብዛት፣ ጠቅላላ መጠን እና የክፍያ ሁኔታ ያሳያል። ለሙሉ ዝርዝር ማንኛውንም ግቤት ይንኩ።', 'Galmee tokkoon tokkoon guyyaa, maamila, lakkoofsa meelataa, hamma waliigalaa, fi haala kaffaltii agarsiisa. Ibsa guutuu fudhachuuf galmee kamiyyuu tuqi.', 'ነፍሲ ወከፍ መዝገብ ዕለት፡ ደንበኛ፡ ብዝሒ ዕቃ፡ ጠቕላላ መጠን ከምኡውን ኩነት ክፍሊት የርእይ እዩ። ንምሉእ ዝርዝራት ዝኾነ መዝገብ ጠውቑ።');
add('Enable fingerprint or face ID for quicker, secure access to the app without entering your PIN each time.', 'የጣት አሻራ ወይም የፊት መለያን ያንቁ በየጊዜው PIN ሳያስገቡ ፈጣን እና አስተማማኝ የመተግበሪያ መዳረሻ ለማግኘት።', 'Mallattoo quba ykn fuula idatti galchi appii keessa yeroo hunda PIN hin galchin ariifachiisaa fi nageenyaan galuuf.', 'ነጥቢ ኣጻብዕ ወይ መለልዒ ገጽ ኣንቅሑ ንፍጥን ውሕስን መእተዊ ኣፕሊኬሽን ንምርካብ ነፍሲ ወከፍ ግዜ PIN ከይኣእትዉ።');
add('Control which alerts you receive — stock shortages, expiration reminders, daily summaries, credit alerts, and more.', 'የሚቀበሏቸውን ማንቂያዎች ይቆጣጠሩ — የክምችት እጥረት፣ የማለቂያ ጊዜ ማሳሰቢያዎች፣ ዕለታዊ ማጠቃለያዎች፣ የብድር ማንቂያዎች እና ሌሎችም።', 'Riccata fudhattu bulchi — gowwoomsa kuusaa, yaadannoo xumuraa, guduunfaa guyyaa, riccata liqii fi kan biroo.', 'እትቕበልዎም መጠንቀቕታታት ተቆጻጸሩ — ስኡን ክምችት፡ ኣማዕሚንታት እዋን ምውዳእ፡ መዓልታዊ ጠቕላላታት፡ መጠንቀቕታታት ብድሪ ከምኡውን ካልኦት።');
add('Switch between English, Amharic, Oromo, and Tigrinya. The calendar, date format, and time system adapt automatically.', 'በእንግሊዝኛ፣ አማርኛ፣ ኦሮሚኛ እና ትግርኛ መካከል ይቀያይሩ። የቀን አቆጣጠር፣ የቀን ቅርጸት እና የሰዓት ስርዓት በራስ-ሰር ይስተካከላሉ።', 'Ingliffaa, Amaaraa, Oromoo, fi Tigrinya gidduu jijjiiri. Kalendariin, foormaatii guyyaa, fi sirni yerootu ofumaan ni jijjiirama.', 'ኣብ መንጎ እንግሊዝኛ፡ ኣማርኛ፡ ኦሮሚኛ ከምኡውን ትግርኛ ለውጡ። ካላንደር፡ ቅርጸት መዓልቲ ከምኡውን ስርዓት ሰዓት ብርእሶም ይስተኻኸሉ እዮም።');
add('Export your database as a backup file for safekeeping. Regular backups protect your business data against accidental loss.', 'ዳታቤዝዎን እንደ ምጠባበቂያ ፋይል ያስወጡ። መደበኛ ምጠባበቂያዎች የንግድ መረጃዎን ከድንገተኛ ኪሳራ ይጠብቃሉ።', 'Daata-beeyzii kee faayilii olkaa\'uuf ekspoortii godhi. Olkaawwan yeroo yeroon odeeffannoo daldalaa kee hoongoo tasa irraa eegu.', 'ዳታቤዝኩም ከም መጠበቒ ፋይል ኣውጽኡ። መደበኛ መጠበቒታት ሓበሬታ ንግድኩም ካብ ድንገታዊ ምጥፋእ ይጠብቅዎ እዩ።');
add('View the app version, build number, and system status. Check for updates here.', 'የመተግበሪያ ስሪት፣ የግንባታ ቁጥር እና የስርዓት ሁኔታ ይመልከቱ። ለዝማኔዎች እዚህ ይፈትሹ።', 'Version appii, lakkoofsa ijaarsaa, fi haala sirnaa ilaali. Haaromsa asitti sakatta\'i.', 'ስሪት ኣፕሊኬሽን፡ ቁጽሪ ህንጻ ከምኡውን ኩነት ስርዓት ርአዩ። ንምዕራይ ኣብዚ መርምሩ።');
add('Reach out to our support team via email or phone. We\\\'re here to help you with any questions or issues.', 'በኢሜይል ወይም በስልክ የእኛን የድጋፍ ቡድን ያነጋግሩ። ለማንኛውም ጥያቄ ወይም ችግር እኛ እዚህ ነን ለመርዳት።', 'Iimeeliin ykn bilbilaan garee deeggarsaa keenya quunnami. Gaaffii ykn rakkoo kamuu isin gargaaruuf as jirra.', 'ብኢመይል ወይ ብተሌፎን ናብ ጉጅለ ደገፍና ርኸቡና። ንምንእዋን ሕቶ ወይ ጸገም ክንሕግዘኩም ኣብዚ ኣለና።');
add('FAQ & Guides', 'ተደጋጋሚ ጥያቄዎች እና መመሪያዎች', 'Gaaffii Fi Deebii fi Qajeelfama', 'ተደጋጋሚ ሕቶታትን መምርሕታትን');
add('Choose your preferred language', 'የሚመርጡትን ቋንቋ ይምረጡ', 'Afaan filattuu kee filadhu', 'እትመርጽዎ ቋንቋ ምረጹ');
add('Current Language', 'አሁን ያለው ቋንቋ', 'Afaan Ammaa', 'ህሉው ቋንቋ');
add('Your current language is highlighted. Tap a different language to switch.', 'የአሁን ቋንቋዎ ደምቆ ይታያል። ለመቀየር ሌላ ቋንቋ ይንኩ።', 'Afaan kee ammaa ifatti mulata. Jijjiiruuf afaan addaa tuqi.', 'ህሉው ቋንቋኩም ጎልቲቱ ይርአ እዩ። ንምልውጥ ካልእ ቋንቋ ጠውቑ።');
add('Manage your storage locations and organize inventory across multiple warehouses or storage areas.', 'የማከማቻ ቦታዎችዎን ያስተዳድሩ እና ክምችትን በበርካታ መጋዘኖች ወይም የማከማቻ ቦታዎች ያደራጁ።', 'Bakka kuusaa kee bulchi fi kuusaa kuusaalee ykn bakka kuusaa baayee keessatti qindeessi.', 'ቦታታት መከማቸታትኩም ኣመሓድሩ ከምኡውን ክምችት ኣብ ብዙሓት መከማቸታት ወይ ክፍልታት ኣደራጅሉ።');
add('View all your warehouses and storage locations. Each entry shows item count and total stock value.', 'ሁሉንም መጋዘኖችዎን እና የማከማቻ ቦታዎችዎን ይመልከቱ። እያንዳንዱ ግቤት የዕቃ ብዛት እና ጠቅላላ የክምችት ዋጋ ያሳያል።', 'Kuusaalee fi bakka kuusaa kee hunda ilaali. Galmee tokkoon tokkoon lakkoofsa meelataa fi hamma maallaqaa kuusaa waliigalaa agarsiisa.', 'ኩሎም መከማቸታትን ቦታታት መከማቸታትን ርአዩ። ነፍሲ ወከፍ መዝገብ ብዝሒ ዕቃን ጠቕላላ ክብረት ክምችትን የርእይ እዩ።');
add('Manage your warehouse and storage location preferences. Set default warehouses for receiving stock.', 'የመጋዘን እና የማከማቻ ቦታ ምርጫዎችዎን ያስተዳድሩ። ክምችት ለመቀበል ነባሪ መጋዘኖችን ያዘጋጁ።', 'Filannoo kuusaa fi bakka kuusaa kee bulchi. Kuusaa fudhachuuf kuusaalee durtii qindeessi.', 'ምርጫታት መከማቸታትን ቦታ መከማቸታትን ኣመሓድሩ። ክምችት ንምቕባል ነባሪ መከማቸታት ኣዘጋጅሉ።');
add('View all your warehouses with item counts and stock values. Tap to manage each location.', 'ሁሉንም መጋዘኖችዎን ከዕቃ ብዛት እና የክምችት ዋጋ ጋር ይመልከቱ። እያንዳንዱን ቦታ ለማስተዳደር ይንኩ።', 'Kuusaalee kee hunda lakkoofsa meelataa fi hamma maallaqaa kuusaatiin ilaali. Bakka hunda bulchuuf tuqi.', 'ኩሎም መከማቸታትኩም ምስ ብዝሒ ዕቃን ክብረት ክምችትን ርአዩ። ነፍሲ ወከፍ ቦታ ንምሕደራ ጠውቑ።');
add('Configure stock transfer settings — approval requirements, notification preferences, and default transfer reasons.', 'የክምችት ዝውውር ቅንብሮችን ያዋቅሩ — የማጽደቅ መስፈርቶች፣ የማሳወቂያ ምርጫዎች እና ነባሪ የዝውውር ምክንያቶች።', 'Sajaa daddarba kuusaa qindeessi — fedhii mirkaneessaa, filannoo beekkonsaa, fi sababa daddarba durtii.', 'ምምሕዳራት ምዝውዋር ክምችት ኣዋቅሩ — መስፈርታት ምርግጋጽ፡ ምርጫታት መፍለጢ ከምኡውን ነባሪ ምኽንያታት ምዝውዋር።');
add('You\\\'ve completed all the tutorials! Great job getting familiar with the app.', 'ሁሉንም አጋዥ ስልጠናዎች አጠናቀዋል! ከመተግበሪያው ጋር በሚገባ ተላምደዋል።', 'Leenjiiwwan hunda xumurte! Appii waliin barachuu kee milkaa\'ina.', 'ንኩሎም መምርሕታት ፈጺምኩም! ምስ ኣፕሊኬሽን ብደና ለሚድኩም።');
// Batch 6: final entries with correct full EN texts
add('See your total budget, spending to date, and remaining balance. The health indicator shows if you\\\'re on track, near limit, or over budget.', 'ጠቅላላ በጀትዎን፣ እስከ ዛሬ ያወጡትን እና የቀረውን ሂሳብ ይመልከቱ። የጤና አመልካች በትክክል እየተከተሉ፣ ወደ ገደብ እየተቃረቡ ወይም ከበጀት በላይ መሆኑን ያሳያል።', 'Baajeta kee waliigalaa, baasii har\'aa, fi haaraa hafe ilaali. Mallattoon fayyaa karaa irra jirtu, daangaa bira jirtu, ykn baajeta irraa dabarte agarsiisa.', 'ጠቕላላ በጀትኩም፡ ክሳዕ ሎሚ እተወጻእኩምዎን እተረፈ ሂሳብን ርአዩ። መለልዒ ጥዕና ብቑዕ ኮይኑ ከም ዝኸዱ፡ ናብ ደረት ከም ዝቐረቡ ወይ ካብ በጀት ከም ዘለፉ የርእይ እዩ።');
add('Enter the customer\\\'s name. This is required for order tracking. Existing customers will auto-complete as you type.', 'የደንበኛውን ስም ያስገቡ። ይህ ለትእዛዝ ክትትል አስፈላጊ ነው። ያሉ ደንበኞች ሲተየቡ በራስ-ሰር ይሞላሉ።', 'Maqaa maamila galchi. Kun hordoffii ajajaaf fedhama. Maamilli jiran yeroo barreessitu ofumaan ni guutamu.', 'ስም ደንበኛ ኣእትዉ። እዚ ንምክትታል ትእዛዝ ኣድላዪ እዩ። ዘለዉ ደንበኛታት ከትጽሕፉ ከለኩም ብርእሶም ይመልኡ እዮም።');
add('This is your command center. View today\\\'s revenue, profit, expenses, and sales count at a glance. The dashboard gives you a real-time snapshot of your business health.', 'ይህ የእርስዎ የትእዛዝ ማዕከል ነው። የዛሬን ገቢ፣ ትርፍ፣ ወጪ እና የሽያጭ ብዛት በአንድ እይታ ይመልከቱ። ዳሽቦርዱ ስለ ንግድዎ ጤና ቅጽበታዊ ምስል ይሰጥዎታል።', 'Kun waltajjii abboommii kee. Galii har\'aa, bu\'aa, baasii, fi lakkoofsa gurgurtaa mila tokkootiin ilaali. Daashboordichi suuraa yeroo dhugaa fayyaa daldala keetii siif kenna.', 'እዚ ማእከል ትእዛዝኩም እዩ። ናይ ሎሚ ገቢ፡ ትርፊ፡ ወጻኢ ከምኡውን ብዝሒ ሽያጥ ብሓደ ኣረኣእያ ርአዩ። ዳሽቦርድ ቅጽበታዊ ምስሊ ጥዕና ንግድኩም ይህበኩም እዩ።');
add('View the expense date, description, and whether it\\\'s a recurring payment. Recurring expenses show frequency and next due date.', 'የወጪውን ቀን፣ መግለጫ እና ተደጋጋሚ ክፍያ መሆኑን ይመልከቱ። ተደጋጋሚ ወጪዎች ድግግሞሽ እና የሚቀጥለውን የክፍያ ቀን ያሳያሉ።', 'Guyyaa baasii, ibsa, fi yoo kaffaltii deddeebi\'aa ta\'e ilaali. Baasii deddeebi\'aan yeroo fi guyyaa kaffaltii itti aanu agarsiisa.', 'ዕለት ወጻኢ፡ መግለጺ ከምኡውን ዝደጋገም ክፍሊት ምዃኑ ርአዩ። ዝደጋገሙ ወጻኢታት ድግግሞሽን ቕጽሊ ዕለት ክፍሊትን የርእዩ እዮም።');
add('Follow these steps to add a new product to your inventory. You\\\'ll configure identification, pricing, and classification.', 'አዲስ ምርት ወደ ክምችትዎ ለመጨመር እነዚህን ደረጃዎች ይከተሉ። መለያ፣ ዋጋ አሰጣጥ እና ምደባ ያዋቅራሉ።', 'Tarkaanfiiwwan kana hordofi oomishaa haaraa kuusaa keetti idaasuuf. Addabaafuu, gatii, fi ramaddii qindeessita.', 'ነዞም ደረጃታት ተኸተሉ ሓድሽ ምርት ናብ ክምችትኩም ንምውስኽ። መለለዪ፡ ዋጋ ኣወጣጥር ከምኡውን ምድላብ ከኣዋቅሩ ኢኹም።');
add('Review the details and confirm to apply the price increase. The item\\\'s selling price is updated immediately.', 'ዝርዝሮቹን ይከልሱ እና የዋጋ ጭማሪውን ለመተግበር ያረጋግጡ። የዕቃው የሽያጭ ዋጋ ወዲያውኑ ይዘምናል።', 'Ibsa ilaali fi dabalaa gatii hojiirra ooluuf mirkaneessi. Gatiin gurgurtaa meelataa battaluma ni haaromfama.', 'ዝርዝራት ምርምሩ ከምኡውን ንምትግባር ዋጋ ምውሳኽ ኣረጋግጡ። ዋጋ ሽያጭ እታ ዕቃ ብቕጽበት ክምዕር እዩ።');
add('Reach out to our support team via email or phone. We\\\'re here to help with any issues or questions.', 'በኢሜይል ወይም በስልክ የእኛን የድጋፍ ቡድን ያነጋግሩ። ለማንኛውም ችግር ወይም ጥያቄ እኛ እዚህ ነን ለመርዳት።', 'Iimeeliin ykn bilbilaan garee deeggarsaa keenya quunnami. Rakkoo ykn gaaffii kamuu keessatti isin gargaaruuf as jirra.', 'ብኢመይል ወይ ብተሌፎን ናብ ጉጅለ ደገፍና ርኸቡና። ንዝኾነ ጸገም ወይ ሕቶ ክንሕግዘኩም ኣብዚ ኣለና።');
add('You\\\'ve completed the {name} tutorial.', 'የ{name} አጋዥ ስልጠና አጠናቀዋል።', 'Leenjii {name} xumurteetta.', 'መምርሒ {name} ፈጺምኩም።');

const json = JSON.stringify(entries, null, 2);
fs.writeFileSync('scripts/translations-all.json', json, 'utf8');
console.log('Wrote ' + entries.length + ' entries to scripts/translations-all.json');
