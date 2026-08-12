const fs = require('fs');

const translations = [
"common.notes | ማስታወሻዎች",
"security.biometrics | ባዮሜትሪክስ",
"security.i_saved_it | አስቀምጫለሁ",
"detail.notes | ማስታወሻዎች",
"common.weekdays | የሳምንቱ ቀናት",
"notif.supplier_review_msg | የአቅራቢ አፈጻጸም መገምገሚያ ጊዜ",
"dash.write_off_title | የኪሳራ መጻፍ",
"search.uncategorized | ምድብ ያልተመደበ",
"search.damaged | የተጎዳ",
"assistant.best_selling_title | በጣም የተሸጡ",
"assistant.slow_moving_title | በዝግታ የሚንቀሳቀስ",
"tutorial.adjustment-history.title | የማስተካከያ ታሪክ",
"tutorial.collect-payments.steps.cp-commit.desc | ክፍያውን ለማስተካከል ዝርዝሮቹን ይገምግሙ እና ያረጋግጡ። የደንበኛው የዱቤ ሂሳብ ወዲያውኑ ይዘምናል።",
"tutorial.contact-details.title | የእውቂያ ዝርዝሮች",
"tutorial.contact-details.subtitle | የእውቂያ መረጃ እና እንቅስቃሴ",
"tutorial.damaged-item.steps.di-reason.title | የኪሳራ ምክንያት",
"tutorial.dashboard.steps.dash-alerts.title | የማንቂያ ማዕከል",
"tutorial.expense-details.steps.ed-budget.desc | ይህ ወጪ ወደ በጀት ከተመደበ፣ ከበጀቱ ጋር ሲነጻጸር እንዴት እንደሚቆም ይመልከቱ።",
"tutorial.expense-details.steps.ed-actions.title | ወጪ ያስተካክሉ ወይም ያስወግዱ",
"tutorial.inventory.title | የክምችት ቫልት",
"tutorial.inventory.steps.inventory.desc | ሁሉንም የክምችት ዕቃዎችዎን በአንድ ቦታ ይመልከቱ እና ያስተዳድሩ። ዕቃዎችን ይፈልጉ፣ ደረጃዎችን ይከታተሉ፣ እንቅስቃሴዎችን ይመልከቱ እና ክምችትን ያስተዳድሩ።",
"tutorial.item-details.steps.id-details.desc | ሙሉ የዕቃ ዝርዝሮች፦ የክምችት ደረጃዎች፣ ዋጋዎች፣ ምድብ እና መግለጫ። የዋጋ አሰራር እና የአቅራቢ መረጃ እዚህ ይገኛሉ።",
"tutorial.oncredit-list.steps.oncredit-list.desc | ሁሉም ክፍያ የሚጠበቅባቸው የዱቤ ግብይቶች ዝርዝር። መጠኖችን፣ ቀኖችን እና የደንበኛ መረጃን ይመልከቱ።",
"tutorial.oncredit-list.steps.ocl-list.desc | እያንዳንዱ ግቤት የደንበኛ ስም፣ ጠቅላላ መጠን፣ የቀረ ሂሳብ እና የልጥፍ ቀን ያሳያል። ለዝርዝር እይታ ወይም ክፍያ ለመሰብሰብ ይንኩ።",
"tutorial.price-decrease.subtitle | የመሸጫ ዋጋን ወደ ታች ያስተካክሉ",
"tutorial.price-decrease.steps.pd-search.title | ዕቃ ይፈልጉ",
"tutorial.profile-settings.steps.pset-save.desc | ሁሉም ነገር ትክክል መሆኑን ያረጋግጡ እና ለውጦችዎን ያስቀምጡ። መገለጫዎ ወዲያውኑ ይዘምናል።",
"tutorial.sales-details.steps.sd-pricing.desc | የክፍል ዋጋ፣ ብዛት፣ ቅናሾች እና የተጨማሪ እሴት ቀረጥ። የተጣራ ድምር ከሁሉም ተግባራዊ የዋጋ ማስተካከያዎች በኋላ ይሰላል።",
"tutorial.sales-hub.steps.sales-revenue.desc | የአሁኑን የሽያጭ ጊዜ ጠቅላላ ገቢ እና የተጣራ ትርፍ ይመልከቱ። እነዚህ አመላካቾች የሚዘምኑት በሚሸጡበት ጊዜ ነው።",
"tutorial.sales-records.steps.sr-summary.desc | የሽያጭ አፈጻጸምን በተለያዩ የጊዜ ክፍሎች ያወዳድሩ። የዕለታዊ፣ ሳምንታዊ እና ወርሃዊ አዝማሚያዎች የንግድ እድገትን ያሳያሉ።",
"tutorial.sales-records.steps.sr-list.desc | ሁሉም የተጠናቀቁ ግብይቶች ከቀን፣ ደንበኛ፣ መጠን እና የክፍያ ሁኔታ ጋር። ሙሉ ዝርዝሮችን ለማየት ማንኛውንም ሽያጭ ይንኩ።",
"tutorial.sales-records.steps.sr-export.title | ወደ ውጭ መላክ እና ማጋራት",
"tutorial.security-settings.subtitle | ፒን እና ባዮሜትሪክስ ያዋቅሩ",
"tutorial.settings.steps.settings-profile.title | መገለጫ ቅንብሮች",
"tutorial.settings.steps.settings-language.desc | የሚመርጡትን ቋንቋ እና አካባቢያዊ ቅርጸቶች (ቀን፣ ሰዓት፣ ገንዘብ) ይምረጡ። የአሁኑ ቋንቋ ጎልቶ ይታያል።",
"tutorial.summary.subtitle | የንግድ አፈጻጸምን በአንድ እይታ ይመልከቱ",
"tutorial.support.subtitle | ድጋፍ ያግኙ እና መረጃን ይመልከቱ",
"tutorial.support.steps.su-contact.title | ድጋፍ ያግኙ",
"tutorial.warehouse-settings.steps.warehouse-settings.title | የመጋዘን ቅንብሮች",
"tutorial.warehouse-settings.steps.ws-default.title | ነባሪ መጋዘን",
"tutorial.menu_start | ጀምር",
"screen.sales_hub | የሽያጭ ማዕከል",
];

const outPath = "C:\\Users\\Natol\\Desktop\\Projects\\shega-mobile\\gen-translations-part6.txt";
const lines = translations.map(t => {
  const [key, val] = t.split(' | ');
  return `'${key}': '${val.replace(/'/g, "\\'")}',`;
});
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`Written ${lines.length} lines`);
