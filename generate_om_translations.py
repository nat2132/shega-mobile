import re

# Read the file
with open(r'C:\Users\Natol\Desktop\Projects\shega-mobile\src\context\SettingsContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract EN section keys
en_start = content.index('en: {')
en_end = content.index('am: {')
en_section = content[en_start:en_end]

en_dict = {}
for m in re.finditer(r"'([^']+)':\s*'(.*)'", en_section):
    key = m.group(1)
    val = m.group(2)
    en_dict[key] = val

# Extract OM section keys
om_start = content.index('om: {')
ti_start = content.index('ti: {')
om_section = content[om_start:ti_start]
om_keys = set(re.findall(r"'([^']+)':", om_section))

# Find missing keys
missing = [k for k in en_dict if k not in om_keys]

# Comprehensive Oromo translations
om = {}

# ======= account =======
om['account.continue'] = 'Itti fufi'

# ======= adj =======
om['adj.asset_drain'] = 'Dhabamsa Qabeenyaa'
om['adj.asset_valuation'] = 'Walgatii Qabeenyaa'
om['adj.audit_id'] = 'ID QORMAA'
om['adj.authorize_loss'] = 'Hoona Hayyama'
om['adj.available'] = 'Jira'
om['adj.change'] = 'JIJJIIRAMA'
om['adj.commit_adjustment'] = 'Sirreeffama Mirkaneessi'
om['adj.delete_confirm'] = 'Sirreeffama kana haquu?'
om['adj.elevation_complete'] = 'OLKAASUU XUMURAME'
om['adj.integrity_audit'] = 'Qormaata Qulqullina fi Hoonaa'
om['adj.loss_authorized'] = 'HOONA HAYYAMAME'
om['adj.loss_magnitude'] = "Baay'ina Hoonaa"
om['adj.loss_qty'] = 'Hanga Hoonaa'
om['adj.loss_reason'] = 'Sababa Hoonaa'
om['adj.magnitude'] = "BAY'INA"
om['adj.market_impact'] = 'Dhiibbaa Gabayaa'
om['adj.original'] = 'Jalqabaa'
om['adj.pack'] = 'Paakii'
om['adj.precision_price'] = 'Gatii Sirrii'
om['adj.price_rectify'] = 'Sirreeffama Gatii'
om['adj.reason_broken'] = 'Cabee'
om['adj.reason_defective'] = 'Sammuu'
om['adj.reason_expired'] = 'Yeroo Darbe'
om['adj.reason_market'] = 'Jijjiirama Gabayaa'
om['adj.reason_policy'] = 'Jijjiirama Seeraa'
om['adj.reason_promo'] = 'Xumura Beeksisaa'
om['adj.reason_supplier'] = 'Haaromfama Daldalaa'
om['adj.reason_water'] = 'Miidhaa Bishaanii'
om['adj.rectification_reason'] = 'Sababa Sirreeffamaa'
om['adj.reduction_applied'] = "HIR'ISUU HOJIIRA OLE"
om['adj.scale'] = 'Madaala'
om['adj.search_asset'] = 'Qabeenya Barbaadi'
om['adj.search_placeholder'] = 'Kuusaa Barbaadi...'
om['adj.security_footer'] = 'GALMEE HIN DOOFAMNE \\u2022 SAREEGA NAGEENYAA HOJIIRA \\n SIRNA HORDOFFII HONAA GATII'
om['adj.select_asset'] = 'Qabeenya sirreessuuf filadhu'
om['adj.select_reason_placeholder'] = 'Sababa jijjiirama gatii filadhu...'
om['adj.target_asset'] = 'Qabeenya Akeessaa'
om['adj.unit'] = 'Yuunitii'
om['adj.valuation_impact'] = 'Dhiibbaa WALGATII'

# ======= assistant =======
om['assistant.action_restock'] = 'Amma kuusaa guuti'
om['assistant.action_review_expenses'] = 'Baasii sakatta\'i'
om['assistant.action_view_customers'] = 'Maamila ilaali'
om['assistant.best_selling_item'] = '{name} ({qty} gurgurame)'
om['assistant.best_selling_title'] = 'Meeshaalee Baay\'ee Gurguramu'
om['assistant.best_selling_value'] = '{name} gurgurtaa dura'
om['assistant.damaged_desc'] = '{count} meeshaalee miidhaman. akka miidhametti'
om['assistant.damaged_title'] = '{count} Meeshaalee Miidhaman'
om['assistant.debt_customers_desc'] = 'Waliigala hin kaffalamne: ETB {amount}. {overdue} turte.'
om['assistant.debt_customers_title'] = '{count} Maamila Liqii Hojiira'
om['assistant.expense_increase_desc'] = 'Baasiin ETB {diff} baatii darbee waliin jijjiirame.'
om['assistant.expense_increase_title'] = 'Dabala Baasii Argame'
om['assistant.highest_value_item'] = '{name} (ETB {value})'
om['assistant.highest_value_title'] = 'Meeshaalee Gatii Olaanaa'
om['assistant.low_stock_desc_few'] = '{names} dhumaacha jiru.'
om['assistant.low_stock_desc_many'] = '{names} fi {count} dabalataa kuusaa guutuu barbaadu.'
om['assistant.slow_moving_desc'] = 'Meeshaaleen kun saffisaan hojiirra hin jiran. Beeksisa ykn walitti-qabaa yaadi.'
om['assistant.slow_moving_title'] = '{count} Meeshaalee Suuta Gurguramu'

# ======= budget =======
om['budget.alert_threshold'] = 'Daangaa Akeekkachiisa'
om['budget.all_periods'] = 'Yeroo Hunda'
om['budget.all_types'] = 'Gosa Hunda'
om['budget.budget_vs_actual'] = 'Bajeetii fi Dhugaa'
om['budget.pending_adjustments'] = 'Sirreeffama Eegaa'

# ======= common =======
om['common.day_fri'] = 'Jimaata'
om['common.day_mon'] = 'Wixata'
om['common.day_sat'] = 'Sanbata'
om['common.day_sun'] = 'Dilbata'
om['common.day_thu'] = 'Kamiisa'
om['common.day_tue'] = 'Qibxata'
om['common.day_wed'] = 'Roobii'
om['common.days'] = 'Guyyoota'
om['common.deleted'] = 'Haqameera'
om['common.edited'] = "Fooyya'eera"
om['common.entries'] = 'galmee'
om['common.notes'] = 'Yaadanno'
om['common.optional'] = 'Filannoo'
om['common.preview'] = 'Dur-ilaalcha'
om['common.save_changes'] = "Jijjiirama Ol kaa'i"
om['common.search_customer'] = 'Maamila barbaadi...'
om['common.tap_to_change'] = 'Jijjiiramaaf qabii'
om['common.unit'] = 'Yuunitii'
om['common.unknown'] = 'Hin beekamu'
om['common.verify'] = 'Mirkaneessi'

# ======= dash =======
om['dash.amount_exceeds'] = "Baay'inni waliigala liqii caaluu hin qabu."
om['dash.amount_received'] = 'Maallaqa fudhatame'
om['dash.amount_required'] = "Baay'ina sirrii galchi"
om['dash.confirm_payment'] = 'Kaffaltii Mirkaneessi'
om['dash.customer_id'] = 'ID: {id}'
om['dash.debt_written_off'] = 'Liqin haqameera'
om['dash.no_outstanding'] = 'Haftee maamila hin jiru.'
om['dash.pending'] = 'Eegaa'
om['dash.settle_credit'] = 'Liqii Kaffali'
om['dash.settlement_recorded'] = "Kaffaltiin galmaa'e"
om['dash.total_outstanding'] = 'Waliigala hin kaffalamne'
om['dash.unregistered'] = "HIN GALMAA'IN"
om['dash.write_off_action'] = 'Haqui'
om['dash.write_off_msg'] = 'Liqii {name} akka hoonaatti galmeessaa?'
om['dash.write_off_title'] = 'Akka Hoonaatti Galmeessi'

# ======= detail =======
om['detail.advanced_details'] = "BAL'INA OL-AANAA"
om['detail.call_supplier_cta'] = 'Daldala bilbil'
om['detail.could_not_call'] = "Bilbilli jalqabuu hin dandeenye"
om['detail.delete_confirm'] = "Galmee kana haquu mirkaneessitaa? Hojiin kun deebi'uu hin danda'u."
om['detail.delete_title'] = 'Galmee Haquu?'
om['detail.no_phone_set'] = "Bilbilli hin kaa'amne"
om['detail.no_supplier_phone'] = 'Lakkoofsi bilbilaa daldalaa kanaaf hin jiru'
om['detail.notes'] = 'YAADANNOO'
om['detail.quality_grade'] = 'QABXII QULQULLINA'
om['detail.supplier_info'] = 'ODEEFFANNOO DALDALAA'
om['detail.tax_config'] = 'QINDEESSAA GIBIRAA'

# ======= dt =======
om['dt.step_done'] = 'Xumurame'

# ======= expense =======
om['expense.add'] = 'Baasii Idaki'
om['expense.committed'] = "Galmaa'eera"
om['expense.erase_outflow'] = 'BAASII HAQU'
om['expense.erased_success'] = 'Baasiin Haqameera'
om['expense.failed_to_save'] = "Baasii olkaa'uu hin dandeenye"
om['expense.funds_recovered'] = "Maallaqni Deebi'eera"
om['expense.inventory_loss'] = 'Hoona Kuusaa'
om['expense.modified_success'] = "Baasiin Fooyya'eera"
om['expense.modify_outflow'] = 'BAASII SIRREESSI'
om['expense.no_pulse'] = 'Sochiin baasii hin argamne'
om['expense.no_records'] = 'Galmeen hin argamne.'
om['expense.overall_loss'] = 'Hoona Waliigalaa'
om['expense.recent_trans'] = 'Sochii Dhiyoo'
om['expense.select_category'] = 'Maaloo ramaddii filadhu'
om['expense.total_expense'] = 'Baasii Waliigalaa'
om['expense.transactions'] = 'Daldaloo'
om['expense.upcoming_payments'] = 'Kaffaltii Dhufu'
om['expense.validation_amount'] = "Baay'ina"
om['expense.validation_name'] = 'Ibsa / Kaffalaa'
om['expense.view_list'] = 'Baasii hunda ilaali'

# ======= inv =======
om['inv.bags_left'] = 'baagii hafe'
om['inv.category_title'] = 'Ramaddii'
om['inv.empty_subtitle'] = "Meeshaalee ida'i ykn calabaa jijjiiri"
om['inv.expires_in'] = 'Guyyaa {days} keessatti xumura'
om['inv.minutes_ago'] = 'Daqiiqaa {count} dura'
om['inv.no_items_found'] = 'Meeshaa hin argamne'
om['inv.none_left'] = 'Hin hafne'
om['inv.order_date'] = 'Guyyaa: {date}'
om['inv.order_item_name'] = 'Maqaa Meeshaa'
om['inv.order_notes'] = 'Yaadanno'
om['inv.order_quantity'] = "Baay'ina Ajajaa"
om['inv.order_total_items'] = 'Meeshaalee Waliigalaa: {count}'
om['inv.product_order_list'] = 'Tarree Ajaja Meeshaa'
om['inv.sort_title'] = 'Tartibaan'

# ======= inventory =======
om['inventory.asset_valuation'] = 'Walgatii Qabeenyaa Kallattii'
om['inventory.base_cost'] = 'Gatii Bituu Bu\'uuraa'
om['inventory.base_price'] = 'Gatii Gurgurtaa Bu\'uuraa'
om['inventory.base_unit'] = 'Yuunitii Bu\'uuraa'
om['inventory.category_stock'] = 'Kuusaa Ramaddiidhaan'
om['inventory.company_name'] = 'Maqaa Dhaabbataa'
om['inventory.days_ago'] = 'guyyaa dura'
om['inventory.days_left'] = 'guyyaa hafe'
om['inventory.days_remaining'] = 'Guyyoota Haflan'
om['inventory.failed_to_save'] = "Meeshaa olkaa'uu hin dandeenye"
om['inventory.fast_moving'] = 'Saffisaan Gurguramu'
om['inventory.is_credit'] = 'Bituu Liqii'
om['inventory.low_stock'] = 'Meeshaalee Dhumuuf Jiran'
om['inventory.no_items'] = 'Meeshaan kuusaa keessatti hin jiru.'
om['inventory.pack_purchase_price'] = 'Gatii Bitaa Paakii'
om['inventory.pack_selling_price'] = 'Gatii Gurgurtaa Paakii'
om['inventory.purchase_unit'] = 'Yuunitii Bitaa'
om['inventory.quality_grade'] = 'Qabxii Qulqullina'
om['inventory.recent_added'] = 'Meeshaalee Dhiyeenyaan Dabalame'
om['inventory.slow_moving'] = 'Suuta Gurguramu'
om['inventory.supplier_account'] = 'Herrega Daldalaa'
om['inventory.supplier_call'] = "Bilbilli Daldalaa Hojiira"
om['inventory.supplier_phone'] = 'Bilbila Daldalaa'
om['inventory.total_packs'] = 'Paakii Waliigalaa'
om['inventory.units_per_pack'] = 'Yuunitii Paakii'

# ======= notif =======
om['notif.active'] = 'Hojiiraa'
om['notif.cancel'] = 'Haquu'
om['notif.cleared'] = 'Qulqulleeffame'
om['notif.critical'] = 'Ariiitii'
om['notif.debt_msg'] = 'Liqii {name} (Birrii {amount}) hin kaffalamne'
om['notif.deficit_alert'] = 'Akeekkachiisa Hanqina'
om['notif.exposure_warning'] = 'Akeekkachiisa Saaxilamummaa'
om['notif.low_stock_msg'] = '{name} kuusaa gadaanaa jira ({qty} hafe)'
om['notif.mark_complete_confirm'] = 'Yaadachiisa kana xumuraa taasisuu?'
om['notif.marked_read'] = 'Beeksisni hundi akka dubbifamee jedhame'
om['notif.open_settings'] = 'Sajantii \\u2192 Subscription bani'
om['notif.priority'] = 'Dursa'
om['notif.reminder_completed'] = 'Yaadachiisni xumurame'
om['notif.reminder_removed'] = 'Yaadachiisni haqame'
om['notif.remove_confirm'] = 'Yaadachiisa kana haquu mirkaneessitaa?'
om['notif.remove_reminder'] = 'Haquu'
om['notif.snooze_15'] = 'Daqiiqaa 15 dheesisuu'
om['notif.snooze_week'] = 'Torban itti dheesisuu'
om['notif.snoozed_for'] = 'Yaadachiisni daqiiqaa {minutes} dheesifame'
om['notif.status'] = 'Haala'
om['notif.status_read'] = 'Dubbifame'
om['notif.status_resolved'] = 'Hirame'
om['notif.status_unread'] = 'Dubbifamne'
om['notif.subscription_renew'] = 'Sajantii \\u2192 License keessatti subscription kee haaromsi.'
om['notif.supplier_call_msg'] = 'Gatiin {name} torban kana jijjiirame. Gatii haaraa daldala waliin mirkaneessi.'
om['notif.supplier_price_down'] = "Gatiin gadi bu'e"
om['notif.supplier_price_up'] = "Gatiin ol ka'e"
om['notif.supplier_review_msg'] = 'Torban 7 dura {name} waliin waamicha goone. Gatii fi kuusaa mirkaneessuu barbaddu?'
om['notif.test_popup'] = 'Koolki Pop-up'
om['notif.test_push'] = 'Koolki Erga'
om['notif.weekly_supplier_alerts'] = 'Akeekkachiisa daldalaa torbe'
om['notif.weekly_supplier_alerts_desc'] = 'Yeroo gatii meeshaa jijjiramu daldala bilbiluuf yaadachiisi'

# ======= sale =======
om['sale.invalid_phone'] = 'Bilbila Sirrii Hin Taane'
om['sale.invalid_phone_msg'] = 'Lakkoofsa bilbilaa sirrii galchi (7-20 lugduu).'
om['sale.invalid_total'] = "Baay'inni waliigalaa sirrii miti. Irraa-bu'aa fi gibiraa mirkaneessi."
om['sale.save_error'] = "Gurgurtaa olkaa'uu hin dandeenye. Meeshaa mirkaneessii deebi'ii yaali."

# ======= sales =======
om['sales.activity_credit'] = 'Liqiidhaan'
om['sales.activity_full'] = 'Kaffaltii Guutuu'
om['sales.activity_partial'] = 'Kaffaltii Gartokkee'
om['sales.checkout_msg'] = 'Checkoutiin xumuramee kuusaan haaromfameera.'
om['sales.confirm_action'] = 'Mirkaneessi'
om['sales.confirm_full_title'] = 'Kaffaltii Guutuu Mirkaneessi'
om['sales.failed_msg'] = 'Gurgurtaa galmeessuu hin dandeenye.'
om['sales.no_payment_data'] = 'Kaffaltii deetaa hin jiru'
om['sales.no_peak_data'] = 'Deetaan gurgurtaa hin jiru'
om['sales.no_sales'] = 'Gurgurtaan dhiyoo hin jiru'
om['sales.no_sales_period'] = 'Gurgurtaan yeroo kanaaf hin jiru'
om['sales.payment_debt'] = 'Liqii'
om['sales.payment_items'] = '{count} meeshaa(wwan) kaffalaman.'
om['sales.payment_methods_modal'] = 'Haala Kaffaltii'
om['sales.payment_paid'] = 'Kaffalame'
om['sales.payment_processed'] = 'Kaffaltiin Hojiira Oole'
om['sales.payment_subtitle'] = "Qoqqoodinsa baay'ina daldalaatiin"
om['sales.peak_sales_hours'] = "Sa'aatii Gurgurtaa Olaanaa"
om['sales.peak_subtitle'] = "Sa'aatii olaanaa baay'ina daldalaatiin"
om['sales.process_return'] = 'Deebisaa Hojiira Oole'
om['sales.return_for'] = 'Deebisaa hojiira ooluuf {itemName}'
om['sales.return_item'] = 'Meeshaa Deebisi'
om['sales.return_max'] = 'Hedduu: {qty} {unit}'
om['sales.return_processed'] = 'Deebisaa Hojiira Oole'
om['sales.return_quantity'] = "Baay'ina Deebisaa"
om['sales.return_reason_label'] = 'Sababa Deebisaa'
om['sales.return_success'] = '{qty} {unit} {itemName} kuusaatti deebi\'eera.'
om['sales.sale'] = 'gurgurtaa'
om['sales.sale_error'] = 'Dogoggora'
om['sales.sale_success'] = 'Gurgurtaan Hojiira Oole'
om['sales.sales_plural'] = 'gurgurtaawwan'
om['sales.stat_method'] = 'Haala'
om['sales.stat_owed'] = 'Liqii'
om['sales.total_revenue'] = 'Galii Waliigalaa'
om['sales.transactions_count'] = '{count} daldaloo'
om['sales.units_sold'] = '{count} yuunitii gurgurame'
om['sales.unknown_method'] = 'Hin beekamu'
om['sales.view_sales'] = 'Gurgurtaa Ilaali'

# ======= search =======
om['search.business'] = 'daldalaa'
om['search.damaged'] = 'Miidhame'
om['search.expense_id'] = 'Baasii'
om['search.monthly'] = "ji'aan"
om['search.paid'] = 'Kaffalame'
om['search.pcs'] = 'cabsa'
om['search.price_down'] = 'Gatii Gadi'
om['search.price_up'] = 'Gatii Ol'
om['search.sale_id'] = 'Gurgurtaa'
om['search.uncategorized'] = 'Hin ramadamne'

# ======= security =======
om['security.authenticate_to'] = '{action} ammanceessuuf of mirkaneessi'
om['security.biometrics'] = 'Biometrics'
om['security.biometrics_desc'] = 'Appii banuuf quba ykn fuula fayyadamuu hayyama.'
om['security.biometrics_enabled'] = 'Biometrics milkaa\'inaan hojiira oole.'
om['security.biometrics_off'] = 'Biometrics Dhaabame'
om['security.biometrics_on'] = 'Biometrics Hojiira'
om['security.change_pin'] = 'PIN Jijjiiri'
om['security.confirm_pin'] = 'PIN Mirkaneessi'
om['security.current_pin'] = 'PIN Ammaa'
om['security.disable_biometrics'] = 'biometrics cufi'
om['security.enable_biometrics'] = 'biometrics bani'
om['security.enter_current_pin'] = 'PIN kee ammaa galchi.'
om['security.generate_recovery'] = 'Koodii Debii Uumi'
om['security.i_saved_it'] = "Olkaa'ee jira"
om['security.identity_failed'] = 'Mirkaneessi eenyummaa kufe.'
om['security.new_pin'] = 'PIN Haaraa'
om['security.pin.confirm'] = 'PIN Mirkaneessi'
om['security.pin.new'] = 'PIN Haaraa'
om['security.recovery_active'] = "Koodiin debii ka'eera"
om['security.recovery_code'] = 'Koodii Debii'
om['security.recovery_desc'] = 'Yoo PIN kee dagatte deebi\'ee seenuuf fayyada.'
om['security.recovery_none'] = 'Koodiin debii hin jiru'
om['security.recovery_shown_once'] = "Koodii kana nageenyaan olkaa'i. Yeroo tokko qofa agarsiifama."
om['security.regenerate_recovery'] = 'Koodii Debii Haaromsi'
om['security.remove_pin'] = 'PIN Haquu'
om['security.set_pin'] = 'PIN Kaayi'
om['security.verify_identity'] = 'Eenyummaa Mirkaneessi'
om['security.your_new_code'] = 'Koodii Debii Haaraa Kee'

# ======= settings =======
om['settings.account'] = 'Sajantii Herregaa'
om['settings.credit_debt'] = 'Liqii fi Liqii'
om['settings.credit_status'] = 'Haala Liqii'
om['settings.credit_status_desc'] = 'Yeroo gurgurtaan liqiin hojjetamu beeksi'
om['settings.daily_summary'] = 'Guduunfaa Guyyaa'
om['settings.daily_summary_desc'] = 'Gabaasa dhuma guyyaa fi KPI ilaaluu'
om['settings.danger_zone'] = "Bakka Balali'aa"
om['settings.date_time_desc'] = "Guyyaan fi sa'aan appii keessatti akkamitti agarsiifamu qindeessi."
om['settings.debt_status'] = 'Haala Liqii'
om['settings.debt_status_desc'] = 'Yeroo liqii hin kaffalamne yeroo dabru beeksi'
om['settings.expiration_status'] = 'Haala Tursa'
om['settings.expiration_status_desc'] = 'Yeroo meeshaan xumuramaaf dhiyoo ta\'u beeksi'
om['settings.lang_note'] = 'Afaan jijjiiruun uffata yeroo sana kalattii haaromsa.'
om['settings.pin_invalid'] = 'PIN 4 lugduu ta\'uu qaba.'
om['settings.pin_mismatch'] = 'PIN wal hin fakkaatu.'
om['settings.remove_desc'] = 'PIN kee kaa\'ame haquuf PIN ammaa olitti galchi.'
om['settings.stock_shortage_desc'] = 'Yeroo meeshaan sadarkaa gadaanaa ga\'u beeksi'
om['settings.support_availability'] = 'Wixata-Jimaata, 9 ganama - 6 waaree booda'
om['settings.time_device_preview'] = 'Dur-ilaalcha meeshaa'
om['settings.time_ethiopian_preview'] = 'Dur-ilaalcha Itoophiyaa'

# ======= summary =======
om['summary.financial_summary'] = 'Guduunfaa Faayinaansii'
om['summary.from_yesterday'] = 'kaleessarra'
om['summary.items_sold'] = "Ida'ama Gurgurtaa"

# ======= support =======
om['support.assistance'] = 'Gargaarsa'
om['support.banner_text'] = 'Gargaarri keenyi sa\'aatii hojii 12 keessatti deebii kenna.'
om['support.cloud_sync'] = 'Walitti-fudhaa Duumessaa Hojiira \\u2022 Qabduu Nageenyaa Hojiira'
om['support.concierge'] = 'Concierge Olaanaa'
om['support.direct_support'] = 'Deeggarsa Sirnaa Kallattii'
om['support.email_channel'] = 'KALLATTII EMAIL'
om['support.orchestration'] = 'InvPro Qindeessaa'
om['support.priority_voice'] = 'Deeggarsa Sagalee Dursaa'
om['support.voice_hours'] = 'Yeroo: 09:00 - 18:00 (GMT+3) argama'
om['support.voice_terminal'] = 'SAGALEE TERMINAL'

# ======= translation =======
om['translation.global_hub'] = 'Cubbuu Addunyaa'
om['translation.localization'] = 'Naannessuu'
om['translation.preview_desc'] = "Qindeessni sirnaa barreeffama ammaa irratti hundaa'eera"
om['translation.preview_label'] = 'DUR-ILAALCHA NAANNESSAA'
om['translation.schema_notice'] = 'Barreeffama haaraa filachuun uffata appii hunda kalattii haaromsa.'
om['translation.selection_heading'] = 'BARREFFAMA QINDEESSUU FILADHU'

# ======= trial =======
om['trial.banner_compact'] = 'Premium Trial\\u00b7{days} hafe'
om['trial.banner_title'] = 'Premium Trial {days} Guyyaa'

# ======= subscription =======
om['subscription.feature_ai_benefit_0'] = 'Gorsa cimaa'
om['subscription.feature_ai_benefit_1'] = 'Hubannoo daldalaa'
om['subscription.feature_ai_benefit_2'] = 'Yeroo qusadhu'
om['subscription.feature_ai_desc'] = 'Hubannoo fi gorsa cimaa daldalaa keef argadhu.'
om['subscription.feature_biometrics_benefit_0'] = 'Seenaa saffisaa'
om['subscription.feature_biometrics_benefit_1'] = 'Nageenya cimaa'
om['subscription.feature_biometrics_benefit_2'] = 'Biftuu ammayyaa'
om['subscription.feature_biometrics_desc'] = 'Appii quba ykn fuula banuun nageenya cimsi.'
om['subscription.feature_budget_benefit_0'] = 'Baasii kee karoorrissi'
om['subscription.feature_budget_benefit_1'] = 'Daangaa kee turi'
om['subscription.feature_budget_benefit_2'] = "Dhabamsa hir'isi"
om['subscription.feature_budget_desc'] = 'Daldalaa keef baajetii uumi fi bulchi.'
om['subscription.feature_csv_export'] = 'CSV Baasuu'
om['subscription.feature_csv_export_benefit_0'] = 'Deetaa deddeebisuu'
om['subscription.feature_csv_export_benefit_1'] = 'Galmee kee deeggarsi godhu'
om['subscription.feature_csv_export_benefit_2'] = 'Spreadsheet irratti xiinxali'
om['subscription.feature_csv_export_desc'] = 'Deetaa daldalaa kee CSV baasi.'
om['subscription.feature_csv_import'] = 'CSV Galchuu'
om['subscription.feature_csv_import_benefit_0'] = "Deetaa baay'ee galchuu"
om['subscription.feature_csv_import_benefit_1'] = 'Yeroo qusadhu'
om['subscription.feature_csv_import_benefit_2'] = "Meeshaalee biroo irraa deebi'i"
om['subscription.feature_csv_import_desc'] = 'Kuusaa fi gurgurtaa CSV irraa galchi.'
om['subscription.feature_dashboard_benefit_0'] = 'Hubannoo daldalaa yeroo gaarii'
om['subscription.feature_dashboard_benefit_1'] = "Safartuu hoji mul'ataan"
om['subscription.feature_dashboard_benefit_2'] = 'Murtoo saffisaa'
om['subscription.feature_dashboard_desc'] = 'Ilaalcha waliigalaa daldalaa kee argadhu.'
om['subscription.feature_debt_benefit_0'] = 'Hanga liqii hordofi'
om['subscription.feature_debt_benefit_1'] = 'Yaadachiisa ofumaan'
om['subscription.feature_debt_benefit_2'] = 'Galii madaala deebisi'
om['subscription.feature_debt_desc'] = 'Liqii maamilaa fi hordoffii kaffaltii bulchi.'
om['subscription.feature_expense_benefit_0'] = "To'annoo faayinaansii cimaa"
om['subscription.feature_expense_benefit_1'] = "Bu'aa hubadhu"
om['subscription.feature_expense_benefit_2'] = 'Baasii cimaa'
om['subscription.feature_expense_desc'] = 'Baasii hunda hordofii malli baasii kee akkam akka fayyadu hubadhu.'
om['subscription.feature_health_benefit_0'] = 'Ilaalcha waliigalaa daldalaa'
om['subscription.feature_health_benefit_1'] = "Rakkoo yeroo baay'ee adda baasi"
om['subscription.feature_health_benefit_2'] = "Fooyya'insa hordofi"
om['subscription.feature_health_desc'] = 'Fayyaa daldalaa kee qabxii waliigalaatiin hordofi.'
om['subscription.feature_multi_warehouse_benefit_0'] = 'Idoo hunda hordofi'
om['subscription.feature_multi_warehouse_benefit_1'] = 'Kuusaa qoodaa cimsi'
om['subscription.feature_multi_warehouse_benefit_2'] = 'Kuusaa guutuu ilaaluu'
om['subscription.feature_multi_warehouse_desc'] = 'Kuusaa iddoo baay\'ee keessatti bulchi.'
om['subscription.feature_orders_benefit_0'] = 'Ajaja tolchi'
om['subscription.feature_orders_benefit_1'] = 'Xumura hordofi'
om['subscription.feature_orders_benefit_2'] = 'Tajaajila maamilaa cimsi'
om['subscription.feature_orders_desc'] = "Ajaja maamilaa ka'uu irraa dhaqqabsiisuu bulchi."
om['subscription.feature_pdf_benefit_0'] = 'Rasiitii ogummaa'
om['subscription.feature_pdf_benefit_1'] = "Galmee kaa'uu salphaa"
om['subscription.feature_pdf_benefit_2'] = 'Maamila waliin qoodi'
om['subscription.feature_pdf_desc'] = 'Rasiitii PDF ogummaa buufi fi qoodi.'
om['subscription.feature_purchase_orders_benefit_0'] = 'Bituu salphisi'
om['subscription.feature_purchase_orders_benefit_1'] = 'Ajaja daldalaa hordofi'
om['subscription.feature_purchase_orders_benefit_2'] = 'Kuusaa bulchi'
om['subscription.feature_purchase_orders_desc'] = 'Daldalaa waliif ajaja bituu uumi fi bulchi.'
om['subscription.feature_reports_benefit_0'] = 'Hoji daldalaa hordofi'
om['subscription.feature_reports_benefit_1'] = 'Murtoo deetaa irratti hundeesi'
om['subscription.feature_reports_benefit_2'] = 'Carraa guddinaa adda baasi'
om['subscription.feature_reports_desc'] = 'Gabaasa fi xiinxala daldalaa cimaa uumi.'
om['subscription.feature_suppliers_benefit_0'] = 'Kaffaltii hin dhiisin'
om['subscription.feature_suppliers_benefit_1'] = 'Walitti dhufeenya cimaa qaba'
om['subscription.feature_suppliers_benefit_2'] = 'Adhabaa ittisuu'
om['subscription.feature_suppliers_desc'] = 'Kaffaltii daldalaa liqiif yaadachiisa argadhu.'
om['subscription.feature_themes_benefit_0'] = 'Biftuu filanno'
om['subscription.feature_themes_benefit_1'] = "Mul'ata ogummaa"
om['subscription.feature_themes_benefit_2'] = 'Biftuu miidhagaa'
om['subscription.feature_themes_desc'] = 'Bifa appii biftuu premium fayyadamuun miidhagsi.'
om['subscription.footer_no_charges'] = 'Kaffaltii hin jiru. Yeroo ergamttootti yeroo barbaadde haquu dandeessa.'
om['subscription.telebirr_account_name'] = 'Shega Business'
om['subscription.upgrade_to_premium'] = 'Premium Bani'

# Generate screen translations based on the EN values
screen_mappings = {
    'screen.activity_ledger': 'Activity Ledger',
    'screen.add_expense': 'Add Expense',
    'screen.add_inventory_item': 'Add Inventory Item',
    'screen.adjustment': 'Adjustments',
    'screen.adjustment_history': 'Adjustment History',
    'screen.budget': 'Budget',
    'screen.collect_payments': 'Collect Payments',
    'screen.contact_details': 'Contact Details',
    'screen.contacts': 'Contacts',
    'screen.create_budget': 'Create Budget',
    'screen.create_order': 'Create Order',
    'screen.damaged_item': 'Damaged Item',
    'screen.dashboard': 'Dashboard',
    'screen.debt_management': 'Debt Management',
    'screen.debt_records': 'Debt Records',
    'screen.expense': 'Expense',
    'screen.expense_details': 'Expense Details',
    'screen.expense_loss': 'Expense Loss',
    'screen.expense_records': 'Expense Records',
    'screen.inventory': 'Inventory',
    'screen.inventory_records': 'Inventory Records',
    'screen.item_details': 'Item Details',
    'screen.low_stock_items': 'Low Stock Items',
    'screen.notifications': 'Notifications',
    'screen.on_credit_list': 'On Credit List',
    'screen.order_details': 'Order Details',
    'screen.orders': 'Orders',
    'screen.pending_sales': 'Pending Sales',
    'screen.price_decrease': 'Price Decrease',
    'screen.price_increase': 'Price Increase',
    'screen.record_sale': 'Record Sale',
    'screen.reminder_history': 'Reminder History',
    'screen.sale_details': 'Sale Details',
    'screen.sales_hub': 'Sales Hub',
    'screen.sales_records': 'Sales Records',
    'screen.settings': 'Settings',
    'screen.summary': 'Summary',
    'screen.warehouse_manager': 'Warehouse Manager',
}

screen_trans = {
    'screen.activity_ledger': 'Galmee Sochii',
    'screen.add_expense': 'Baasii Idaki',
    'screen.add_inventory_item': 'Meeshaa Kuusaa Idaki',
    'screen.adjustment': 'Sirreeffama',
    'screen.adjustment_history': 'Seenaa Sirreeffamaa',
    'screen.budget': 'Bajeetii',
    'screen.collect_payments': 'Kaffaltii Funaanuu',
    'screen.contact_details': 'Bal\'ina Quunnamtii',
    'screen.contacts': 'Quunnamtii',
    'screen.create_budget': 'Bajeetii Uumi',
    'screen.create_order': 'Ajaja Uumi',
    'screen.damaged_item': 'Meeshaa Miidhame',
    'screen.dashboard': 'Dashboordii',
    'screen.debt_management': 'Bulchiinsa Liqii',
    'screen.debt_records': 'Galmee Liqii',
    'screen.expense': 'Baasii',
    'screen.expense_details': 'Bal\'ina Baasii',
    'screen.expense_loss': 'Hoona Baasii',
    'screen.expense_records': 'Galmee Baasii',
    'screen.inventory': 'Kuusaa',
    'screen.inventory_records': 'Galmee Kuusaa',
    'screen.item_details': 'Bal\'ina Meeshaa',
    'screen.low_stock_items': 'Meeshaalee Kuusaa Gadaanaa',
    'screen.notifications': 'Beeksisa',
    'screen.on_credit_list': 'Tarree Liqii',
    'screen.order_details': 'Bal\'ina Ajajaa',
    'screen.orders': 'Ajaja',
    'screen.pending_sales': 'Gurgurtaa Eegaa',
    'screen.price_decrease': 'Hir\'isaa Gatii',
    'screen.price_increase': 'Dabala Gatii',
    'screen.record_sale': 'Gurgurtaa Galmeessi',
    'screen.reminder_history': 'Seenaa Yaadachiisaa',
    'screen.sale_details': 'Bal\'ina Gurgurtaa',
    'screen.sales_hub': 'Cubbuu Gurgurtaa',
    'screen.sales_records': 'Galmee Gurgurtaa',
    'screen.settings': 'Sajantii',
    'screen.summary': 'Cuunfaa',
    'screen.warehouse_manager': 'Bulchiinsa Kuusaa Meeshaa',
}

for k, v in screen_trans.items():
    om[k] = v

# Validate coverage
non_tutorial_missing = [k for k in missing if not k.startswith('tutorial.')]
uncovered = [k for k in non_tutorial_missing if k not in om]
print(f"Non-tutorial missing: {len(non_tutorial_missing)}")
print(f"Covered: {len(om.keys())}")
print(f"Uncovered: {len(uncovered)}")
if uncovered:
    print(f"First 10 uncovered: {uncovered[:10]}")

# Generate the insert block
# Group by prefix
from collections import OrderedDict
groups = OrderedDict()
for key in sorted(om.keys()):
    prefix = key.split('.')[0]
    if prefix not in groups:
        groups[prefix] = []
    groups[prefix].append(key)

lines = []
lines.append('')
for prefix, keys in groups.items():
    lines.append(f"    // {prefix} translations")
    for key in keys:
        val = om[key]
        # Escape single quotes for JSX
        esc_val = val.replace("'", "\\'")
        lines.append(f"    '{key}': '{esc_val}',")
    lines.append('')

insert_block = '\n'.join(lines)
print(f"\nInsert block size: {len(insert_block)} chars")
print(f"Total lines: {len(lines)}")

# Now insert into file
# Find the last line of OM section (the closing '},' before ti: {)
om_end_pos = content.rfind("  },\n  ti:")
insert_pos = content.rfind("  },\n  ti:")
if insert_pos < 0:
    insert_pos = content.rfind("},\n  ti:")

print(f"Insert position found: {insert_pos}")

# Insert the block before the closing brace
new_content = content[:insert_pos] + insert_block + '\n' + content[insert_pos:]

# Write the file
with open(r'C:\Users\Natol\Desktop\Projects\shega-mobile\src\context\SettingsContext.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("File written successfully!")
