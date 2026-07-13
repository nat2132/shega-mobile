// Tutorial translation data: en → [am, om, ti]
// Each module is a batch of t() calls
const extra = [];

function t(en, am, om, ti) {
  extra.push({ en, am, om, ti });
}

// === collect-payments ===
t('Collect Payments','ክፍያዎችን ይሰብስቡ','Kaffaltiiwwan Funyaanuu','ክፍሊታት ምእካብ');
t('Receive payments from customers','ከደንበኞች ክፍያ ይቀበሉ','Kaffaltiiwwan maamila irraa fudhadhu','ካብ ደንበኛታት ክፍሊት ተቐበሉ');
t('Collect Payment','ክፍያ ሰብስብ','Kaffaltii Funyaanuu','ክፍሊት እከቡ');
t('Use this screen to receive payments from customers for credit sales or outstanding balances.','ይህን ስክሪን የምስጋና ሽያጮች ወይም ያልተከፈሉ ሂሳቦች ክፍያ ከደንበኞች ለመቀበል ይጠቀሙ።','Iskiriinii kana fayyadami maamilota irraa kaffaltii gurgurtaa liqii ykn haaraa kaffalamuu hin qabne fudhachuuf.','ነዛ ስክሪን ካብ ደንበኛታት ንሽያጣት ብድሪ ወይ እተረፈ ሂሳብ ንምቕባል ተጠቐሙላ።');
t('Select Customer','ደንበኛ ይምረጡ','Maamila Filadhu','ደንበኛ ምረጹ');
t('Search for the customer making the payment. Select them to see their outstanding invoices.','ክፍያ የሚፈጽመውን ደንበኛ ይፈልጉ። ያልተከፈሉ ኢንቮይሶቻቸውን ለማየት ይምረጡዋቸው።','Maamila kaffaltii kana hojjechaa jiru barbaadi. Isaan filadhu biilota kaffalamuu hin qabne isaanii ilaaluuf.','ነቲ ክፍሊት ዝከፍል ደንበኛ ድለዩ። እተረፈ ሂሳቦም ንምርኣይ ምረጹዎም።');
t('Select Items to Pay','ለመክፈል ዕቃዎች ይምረጡ','Meelawwan Kaffaluuf Filadhu','ክትከፍልዎም እቃታት ምረጹ');
t('Choose which items or invoices the customer is paying for. You can select multiple items.','ደንበኛው የሚከፍላቸውን ዕቃዎች ወይም ኢንቮይሶች ይምረጡ። በርካታ ዕቃዎችን መምረጥ ይችላሉ።','Meelawwan ykn biilota maamilli kaffaluu filadhu. Meelawwan baay\'ee filachuu dandeessa.','እቶም ደንበኛ ዝከፍልዎም እቃታት ወይ ኢንቮይሳት ምረጹ። ብዙሓት እቃታት ክትምርጹ ትኽእሉ ኢኹም።');
t('Payment Amount','የክፍያ መጠን','Hamma Kaffaltii','ልዕሊ ክፍሊት');
t('Enter the amount being paid. The system shows the remaining balance after payment.','የሚከፈለውን መጠን ያስገቡ። ሲስተሙ ከክፍያ በኋላ የቀረውን ሂሳብ ያሳያል።','Hamma kaffalamuu qabu galchi. Sirni haaraa erga kaffaltii booda agarsiisa.','እቲ ዝኽፈል መጠን ኣእትዉ። ሲስተም ድሕሪ ክፍሊት እተረፈ ሂሳብ የርእይ እዩ።');
t('Payment Method','የክፍያ ዘዴ','Mala Kaffaltii','ኣገባብ ክፍሊት');
t('Select how the customer is paying — cash or digital bank transfer.','ደንበኛው እንዴት እንደሚከፍል ይምረጡ — በጥሬ ገንዘብ ወይም በዲጂታል የባንክ ዝውውር።','Maamilli akka kaffalu filadhu — maallaqaan ykn naannoo baankii dijitaalaan.','ደንበኛ ከመይ ከም ዝከፍል ምረጹ — ብገንዘብ ወይ ብዲጂታል ምዝውዋር ባንክ።');
t('Complete Payment','ክፍያ አጠናቅቅ','Kaffaltii Xumuri','ክፍሊት ኣጠናቅቑ');
t('Review the payment details and tap to confirm. The payment will be recorded and the balance updated.','የክፍያ ዝርዝሮችን ይከልሱ እና ለማረጋገጥ ይንኩ። ክፍያው ይመዘገባል እና ሂሳቡ ይዘምናል።','Ibsa kaffaltii ilaali fi mirkaneessuuf tuqi. Kaffaltiin ni galmeeffama; haaraan ni haaromfama.','ዝርዝራት ክፍሊት ምርምሩ ከምኡውን ንምርግጋጽ ጠውቑ። ክፍሊት ክምዝገብ ከምኡውን ሂሳብ ክምዕረ እዩ።');

// === contact-details ===
t('Contact Details','የዕውቅት ዝርዝሮች','Ibsa Qunnamtii','ዝርዝራት ርክብ');
t('View and manage a contact','ዕውቅትን ይመልከቱ እና ያስተዳድሩ','Qunnamtii ilaali fi bulchi','ርክብ ርአዩ ከምኡውን ኣመሓድሩ');
t('Contact Profile','የዕውቅት መገለጫ','Pirootayilii Qunnamtii','መግለጺ ርክብ');
t('This screen shows all information about a contact — personal details, balance, and transaction history.','ይህ ስክሪን ስለ ዕውቅት ሁሉንም መረጃ ያሳያል — የግል ዝርዝሮች፣ ሂሳብ እና የግብይት ታሪክ።','Iskiriinii kun waa\'ee qunnamtii odeeffannoo hunda agarsiisa — ibsa dhuunfaa, haaraa, fi seenaa jijjiiramaa.','እዛ ስክሪን ብዛዕባ ርክብ ኩሉ ሓበሬታ ተርኢ — ዝርዝራት ብሕቲ፣ ሂሳብ ከምኡውን ታሪኽ ልውውጥ።');
t('Contact Information','የዕውቅት መረጃ','Odeeffannoo Qunnamtii','ሓበሬታ ርክብ');
t('View name, phone numbers, account number, category, and notes.','ስም፣ ስልክ ቁጥሮች፣ አካውንት ቁጥር፣ ምድብ እና ማስታወሻዎችን ይመልከቱ።','Maqaa, lakkoofsa bilbilaa, lakkoofsa herregaa, ramaddii, fi yaadannoo ilaali.','ስም፣ ቁጽርታት ተሌፎን፣ ቁጽሪ ኣካውንት፣ መደብ ከምኡውን ምልክታት ርአዩ።');
t('Outstanding Balance','ያልተከፈለ ሂሳብ','Haaraa Kaffalamuu Hin Qabne','እተረፈ ሂሳብ');
t('Any outstanding credit balance for this contact.','ለዚህ ዕውቅት ማንኛውም ያልተከፈለ የብድር ሂሳብ።','Qunnamtii kanaaf haaraan liqii kaffalamuu hin qabne.','ንዚ ርክብ እተረፈ ሂሳብ ብድሪ።');
t('Actions','ድርጊቶች','Gochiiwwan','ተግባራት');
t('Edit contact details, record a sale, or collect payment directly from this screen.','የዕውቅት ዝርዝሮችን ያስተካክሉ፣ ሽያጭ ይመዝግቡ፣ ወይም ከዚህ ስክሪን በቀጥታ ክፍያ ይሰብስቡ።','Ibsa qunnamtii sirreeffadhu, gurgurtaa galmeessi, ykn iskiriinii kana irraa kaffaltii funyaanuu.','ዝርዝራት ርክብ ኣተኻኽሉ፣ ሽያጥ መዝግቡ፣ ወይ ካብዛ ስክሪን ብቐጥታ ክፍሊት እከቡ።');

module.exports = extra;
