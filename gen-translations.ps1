$outputFile = "C:\Users\Natol\Desktop\Projects\shega-mobile\missing-amharic-translations3.txt"
$stream = [System.IO.StreamWriter]::new($outputFile, $false, [System.Text.Encoding]::UTF8)
$stream.WriteLine("'notif.supplier_call_msg': 'የ{name} ዋጋ በዚህ ሳምንት ተቀይሯል። አዲሱን ዋጋ ከአቅራቢው ጋር ያረጋግጡ።',")
$stream.WriteLine("'subscription.feature_reports_benefit_1': 'በመረጃ ላይ የተመሰረተ ውሳኔ ያድርጉ',")
$stream.WriteLine("'detail.quality_grade': 'የጥራት ደረጃ',")
$stream.Close()
Write-Host "Test OK - file written"
