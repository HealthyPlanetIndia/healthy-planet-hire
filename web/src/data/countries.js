// All 193 UN member states with international dialling codes. India first, then alphabetical.
// [code, name, iso]
export const COUNTRIES = [
["+91","India","IN"],
["+93","Afghanistan","AF"],["+355","Albania","AL"],["+213","Algeria","DZ"],["+376","Andorra","AD"],["+244","Angola","AO"],["+1","Antigua and Barbuda","AG"],["+54","Argentina","AR"],["+374","Armenia","AM"],["+61","Australia","AU"],["+43","Austria","AT"],["+994","Azerbaijan","AZ"],
["+1","Bahamas","BS"],["+973","Bahrain","BH"],["+880","Bangladesh","BD"],["+1","Barbados","BB"],["+375","Belarus","BY"],["+32","Belgium","BE"],["+501","Belize","BZ"],["+229","Benin","BJ"],["+975","Bhutan","BT"],["+591","Bolivia","BO"],["+387","Bosnia and Herzegovina","BA"],["+267","Botswana","BW"],["+55","Brazil","BR"],["+673","Brunei","BN"],["+359","Bulgaria","BG"],["+226","Burkina Faso","BF"],["+257","Burundi","BI"],
["+238","Cabo Verde","CV"],["+855","Cambodia","KH"],["+237","Cameroon","CM"],["+1","Canada","CA"],["+236","Central African Republic","CF"],["+235","Chad","TD"],["+56","Chile","CL"],["+86","China","CN"],["+57","Colombia","CO"],["+269","Comoros","KM"],["+242","Congo","CG"],["+243","Congo (DRC)","CD"],["+506","Costa Rica","CR"],["+225","Côte d'Ivoire","CI"],["+385","Croatia","HR"],["+53","Cuba","CU"],["+357","Cyprus","CY"],["+420","Czechia","CZ"],
["+45","Denmark","DK"],["+253","Djibouti","DJ"],["+1","Dominica","DM"],["+1","Dominican Republic","DO"],
["+593","Ecuador","EC"],["+20","Egypt","EG"],["+503","El Salvador","SV"],["+240","Equatorial Guinea","GQ"],["+291","Eritrea","ER"],["+372","Estonia","EE"],["+268","Eswatini","SZ"],["+251","Ethiopia","ET"],
["+679","Fiji","FJ"],["+358","Finland","FI"],["+33","France","FR"],
["+241","Gabon","GA"],["+220","Gambia","GM"],["+995","Georgia","GE"],["+49","Germany","DE"],["+233","Ghana","GH"],["+30","Greece","GR"],["+1","Grenada","GD"],["+502","Guatemala","GT"],["+224","Guinea","GN"],["+245","Guinea-Bissau","GW"],["+592","Guyana","GY"],
["+509","Haiti","HT"],["+504","Honduras","HN"],["+36","Hungary","HU"],
["+354","Iceland","IS"],["+62","Indonesia","ID"],["+98","Iran","IR"],["+964","Iraq","IQ"],["+353","Ireland","IE"],["+972","Israel","IL"],["+39","Italy","IT"],
["+1","Jamaica","JM"],["+81","Japan","JP"],["+962","Jordan","JO"],
["+7","Kazakhstan","KZ"],["+254","Kenya","KE"],["+686","Kiribati","KI"],["+965","Kuwait","KW"],["+996","Kyrgyzstan","KG"],
["+856","Laos","LA"],["+371","Latvia","LV"],["+961","Lebanon","LB"],["+266","Lesotho","LS"],["+231","Liberia","LR"],["+218","Libya","LY"],["+423","Liechtenstein","LI"],["+370","Lithuania","LT"],["+352","Luxembourg","LU"],
["+261","Madagascar","MG"],["+265","Malawi","MW"],["+60","Malaysia","MY"],["+960","Maldives","MV"],["+223","Mali","ML"],["+356","Malta","MT"],["+692","Marshall Islands","MH"],["+222","Mauritania","MR"],["+230","Mauritius","MU"],["+52","Mexico","MX"],["+691","Micronesia","FM"],["+373","Moldova","MD"],["+377","Monaco","MC"],["+976","Mongolia","MN"],["+382","Montenegro","ME"],["+212","Morocco","MA"],["+258","Mozambique","MZ"],["+95","Myanmar","MM"],
["+264","Namibia","NA"],["+674","Nauru","NR"],["+977","Nepal","NP"],["+31","Netherlands","NL"],["+64","New Zealand","NZ"],["+505","Nicaragua","NI"],["+227","Niger","NE"],["+234","Nigeria","NG"],["+850","North Korea","KP"],["+389","North Macedonia","MK"],["+47","Norway","NO"],
["+968","Oman","OM"],
["+92","Pakistan","PK"],["+680","Palau","PW"],["+507","Panama","PA"],["+675","Papua New Guinea","PG"],["+595","Paraguay","PY"],["+51","Peru","PE"],["+63","Philippines","PH"],["+48","Poland","PL"],["+351","Portugal","PT"],
["+974","Qatar","QA"],
["+40","Romania","RO"],["+7","Russia","RU"],["+250","Rwanda","RW"],
["+1","Saint Kitts and Nevis","KN"],["+1","Saint Lucia","LC"],["+1","Saint Vincent and the Grenadines","VC"],["+685","Samoa","WS"],["+378","San Marino","SM"],["+239","São Tomé and Príncipe","ST"],["+966","Saudi Arabia","SA"],["+221","Senegal","SN"],["+381","Serbia","RS"],["+248","Seychelles","SC"],["+232","Sierra Leone","SL"],["+65","Singapore","SG"],["+421","Slovakia","SK"],["+386","Slovenia","SI"],["+677","Solomon Islands","SB"],["+252","Somalia","SO"],["+27","South Africa","ZA"],["+82","South Korea","KR"],["+211","South Sudan","SS"],["+34","Spain","ES"],["+94","Sri Lanka","LK"],["+249","Sudan","SD"],["+597","Suriname","SR"],["+46","Sweden","SE"],["+41","Switzerland","CH"],["+963","Syria","SY"],
["+992","Tajikistan","TJ"],["+255","Tanzania","TZ"],["+66","Thailand","TH"],["+670","Timor-Leste","TL"],["+228","Togo","TG"],["+676","Tonga","TO"],["+1","Trinidad and Tobago","TT"],["+216","Tunisia","TN"],["+90","Türkiye","TR"],["+993","Turkmenistan","TM"],["+688","Tuvalu","TV"],
["+256","Uganda","UG"],["+380","Ukraine","UA"],["+971","United Arab Emirates","AE"],["+44","United Kingdom","GB"],["+1","United States","US"],["+598","Uruguay","UY"],["+998","Uzbekistan","UZ"],
["+678","Vanuatu","VU"],["+58","Venezuela","VE"],["+84","Vietnam","VN"],
["+967","Yemen","YE"],
["+260","Zambia","ZM"],["+263","Zimbabwe","ZW"],
// Observer states and territories with their own dialling arrangements
["+970","Palestine","PS"],["+379","Vatican City","VA"],["+886","Taiwan","TW"],["+852","Hong Kong","HK"],["+853","Macao","MO"],["+383","Kosovo","XK"],["+1","Puerto Rico","PR"],["+590","Guadeloupe","GP"],["+262","Réunion","RE"],["+687","New Caledonia","NC"],["+689","French Polynesia","PF"],["+299","Greenland","GL"],["+298","Faroe Islands","FO"],["+350","Gibraltar","GI"],["+44","Isle of Man","IM"],["+44","Jersey","JE"],["+44","Guernsey","GG"],["+1","Bermuda","BM"],["+1","Cayman Islands","KY"],["+1","British Virgin Islands","VG"],["+1","US Virgin Islands","VI"],["+599","Curaçao","CW"],["+297","Aruba","AW"],["+1","Guam","GU"],["+682","Cook Islands","CK"],["+212","Western Sahara","EH"],
];
// Expected local number length where it is fixed; otherwise any 6 to 12 digits is accepted
export const FIXED_LENGTH = { "+91": 10, "+1": 10, "+971": 9, "+966": 9, "+974": 8, "+968": 8, "+973": 8, "+965": 8, "+977": 10, "+880": 10, "+94": 9, "+975": 8, "+65": 8, "+44": 10, "+61": 9, "+64": 9, "+27": 9, "+92": 10, "+86": 11, "+81": 10, "+82": 10 };
