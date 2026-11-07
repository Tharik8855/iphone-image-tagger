// US states with real towns/neighbourhoods: [name, latitude, longitude, altitude in metres].
// Points are picked a little away from water, so a random spot within ~500 m stays on land.
window.US_PLACES = {
  AL: { name: 'Alabama', cities: [
    ['Birmingham', 33.5186, -86.8104, 180], ['Montgomery', 32.3792, -86.3077, 73],
    ['Huntsville', 34.7304, -86.5861, 195], ['Tuscaloosa', 33.2098, -87.5692, 70] ] },
  AK: { name: 'Alaska', cities: [
    ['Anchorage', 61.2050, -149.8700, 40], ['Fairbanks', 64.8378, -147.7164, 136] ] },
  AZ: { name: 'Arizona', cities: [
    ['Phoenix', 33.4484, -112.0740, 331], ['Scottsdale', 33.4942, -111.9261, 383],
    ['Tempe', 33.4255, -111.9400, 353], ['Tucson', 32.2226, -110.9747, 728],
    ['Flagstaff', 35.1983, -111.6513, 2106] ] },
  AR: { name: 'Arkansas', cities: [
    ['Little Rock', 34.7400, -92.3000, 102], ['Fayetteville', 36.0626, -94.1574, 427],
    ['Fort Smith', 35.3859, -94.3985, 141] ] },
  CA: { name: 'California', cities: [
    ['Los Angeles (Hollywood)', 34.0928, -118.3287, 110], ['Los Angeles (Downtown)', 34.0480, -118.2510, 89],
    ['Santa Monica', 34.0290, -118.4750, 50], ['San Diego (North Park)', 32.7480, -117.1300, 100],
    ['San Francisco (Mission)', 37.7599, -122.4148, 20], ['San Jose', 37.3382, -121.8863, 25],
    ['Sacramento', 38.5750, -121.4800, 9], ['Fresno', 36.7378, -119.7871, 94],
    ['Irvine', 33.6846, -117.8265, 17], ['Palm Springs', 33.8303, -116.5453, 146] ] },
  CO: { name: 'Colorado', cities: [
    ['Denver', 39.7392, -104.9903, 1609], ['Colorado Springs', 38.8339, -104.8214, 1839],
    ['Boulder', 40.0150, -105.2705, 1655], ['Fort Collins', 40.5853, -105.0844, 1525] ] },
  CT: { name: 'Connecticut', cities: [
    ['Hartford', 41.7637, -72.6851, 18], ['New Haven', 41.3083, -72.9279, 18],
    ['Stamford', 41.0600, -73.5400, 15] ] },
  DE: { name: 'Delaware', cities: [
    ['Wilmington', 39.7500, -75.5550, 25], ['Dover', 39.1582, -75.5244, 10],
    ['Newark', 39.6837, -75.7497, 38] ] },
  DC: { name: 'Washington DC', cities: [
    ['Washington (Downtown)', 38.9072, -77.0369, 22], ['Washington (Capitol Hill)', 38.8899, -76.9950, 25] ] },
  FL: { name: 'Florida', cities: [
    ['Miami (Little Havana)', 25.7650, -80.2250, 3], ['Miami (Wynwood)', 25.8010, -80.2000, 3],
    ['Orlando', 28.5384, -81.3789, 32], ['Tampa (Seminole Heights)', 27.9900, -82.4590, 15],
    ['Jacksonville', 30.3400, -81.7000, 5], ['Fort Lauderdale', 26.1300, -80.1600, 3],
    ['Tallahassee', 30.4383, -84.2807, 62], ['St. Petersburg', 27.7700, -82.6600, 15] ] },
  GA: { name: 'Georgia', cities: [
    ['Atlanta (Midtown)', 33.7810, -84.3830, 300], ['Atlanta (Downtown)', 33.7490, -84.3880, 320],
    ['Savannah', 32.0700, -81.0950, 15], ['Athens', 33.9519, -83.3576, 236],
    ['Augusta', 33.4735, -82.0105, 45] ] },
  HI: { name: 'Hawaii', cities: [
    ['Honolulu (Makiki)', 21.2970, -157.8260, 15], ['Kailua', 21.3950, -157.7500, 5] ] },
  ID: { name: 'Idaho', cities: [
    ['Boise', 43.6150, -116.2023, 824], ['Idaho Falls', 43.4917, -112.0339, 1435],
    ['Coeur d\'Alene', 47.6900, -116.7800, 668] ] },
  IL: { name: 'Illinois', cities: [
    ['Chicago (River North)', 41.8916, -87.6345, 180], ['Chicago (Lincoln Park)', 41.9214, -87.6513, 180],
    ['Naperville', 41.7508, -88.1535, 215], ['Springfield', 39.7817, -89.6501, 182] ] },
  IN: { name: 'Indiana', cities: [
    ['Indianapolis', 39.7684, -86.1581, 218], ['Fort Wayne', 41.0793, -85.1394, 248],
    ['Bloomington', 39.1653, -86.5264, 235] ] },
  IA: { name: 'Iowa', cities: [
    ['Des Moines', 41.5868, -93.6250, 255], ['Iowa City', 41.6611, -91.5302, 210] ] },
  KS: { name: 'Kansas', cities: [
    ['Wichita', 37.6872, -97.3301, 400], ['Topeka', 39.0473, -95.6752, 290],
    ['Lawrence', 38.9717, -95.2353, 270] ] },
  KY: { name: 'Kentucky', cities: [
    ['Louisville (Highlands)', 38.2350, -85.7300, 160], ['Lexington', 38.0406, -84.5037, 298],
    ['Bowling Green', 36.9685, -86.4808, 150] ] },
  LA: { name: 'Louisiana', cities: [
    ['New Orleans (Mid-City)', 29.9720, -90.0960, 1], ['Baton Rouge', 30.4450, -91.1600, 17],
    ['Lafayette', 30.2241, -92.0198, 11], ['Shreveport', 32.5252, -93.7502, 60] ] },
  ME: { name: 'Maine', cities: [
    ['Portland', 43.6700, -70.2800, 20], ['Bangor', 44.8012, -68.7778, 40] ] },
  MD: { name: 'Maryland', cities: [
    ['Baltimore (Mt Vernon)', 39.3070, -76.6170, 30], ['Silver Spring', 38.9907, -77.0261, 100],
    ['Frederick', 39.4143, -77.4105, 90] ] },
  MA: { name: 'Massachusetts', cities: [
    ['Boston (South End)', 42.3388, -71.0765, 5], ['Cambridge', 42.3736, -71.1097, 12],
    ['Worcester', 42.2626, -71.8023, 145] ] },
  MI: { name: 'Michigan', cities: [
    ['Detroit (Midtown)', 42.3480, -83.0600, 183], ['Ann Arbor', 42.2808, -83.7430, 256],
    ['Grand Rapids', 42.9600, -85.6550, 185], ['Lansing', 42.7325, -84.5555, 260] ] },
  MN: { name: 'Minnesota', cities: [
    ['Minneapolis', 44.9600, -93.2750, 260], ['St. Paul', 44.9600, -93.1100, 214],
    ['Rochester', 44.0121, -92.4802, 300] ] },
  MS: { name: 'Mississippi', cities: [
    ['Jackson', 32.2988, -90.1848, 85], ['Hattiesburg', 31.3271, -89.2903, 53],
    ['Oxford', 34.3665, -89.5192, 150] ] },
  MO: { name: 'Missouri', cities: [
    ['Kansas City (Crossroads)', 39.0800, -94.5850, 280], ['St. Louis (Midtown)', 38.6300, -90.2400, 150],
    ['Springfield', 37.2089, -93.2923, 395], ['Columbia', 38.9517, -92.3341, 230] ] },
  MT: { name: 'Montana', cities: [
    ['Billings', 45.7833, -108.5007, 950], ['Bozeman', 45.6770, -111.0429, 1461],
    ['Helena', 46.5891, -112.0391, 1240] ] },
  NE: { name: 'Nebraska', cities: [
    ['Omaha', 41.2600, -95.9600, 332], ['Lincoln', 40.8136, -96.7026, 358] ] },
  NV: { name: 'Nevada', cities: [
    ['Las Vegas (Strip)', 36.1147, -115.1728, 620], ['Las Vegas (Downtown)', 36.1699, -115.1398, 610],
    ['Henderson', 36.0395, -114.9817, 570], ['Reno', 39.5350, -119.8200, 1373] ] },
  NH: { name: 'New Hampshire', cities: [
    ['Manchester', 42.9900, -71.4450, 85], ['Concord', 43.2050, -71.5500, 88] ] },
  NJ: { name: 'New Jersey', cities: [
    ['Newark', 40.7357, -74.1724, 30], ['Jersey City (Journal Sq)', 40.7330, -74.0630, 30],
    ['Princeton', 40.3573, -74.6672, 60] ] },
  NM: { name: 'New Mexico', cities: [
    ['Albuquerque', 35.0844, -106.6504, 1520], ['Santa Fe', 35.6870, -105.9378, 2194],
    ['Las Cruces', 32.3199, -106.7637, 1191] ] },
  NY: { name: 'New York', cities: [
    ['Manhattan (Midtown)', 40.7549, -73.9840, 15], ['Manhattan (Upper West Side)', 40.7870, -73.9754, 30],
    ['Brooklyn (Crown Heights)', 40.6782, -73.9442, 25], ['Brooklyn (Williamsburg)', 40.7110, -73.9500, 10],
    ['Queens (Astoria)', 40.7644, -73.9235, 15], ['Bronx', 40.8448, -73.8648, 30],
    ['Buffalo', 42.8950, -78.8650, 183], ['Rochester', 43.1566, -77.6088, 154],
    ['Syracuse', 43.0481, -76.1474, 120] ] },
  NC: { name: 'North Carolina', cities: [
    ['Charlotte', 35.2271, -80.8431, 229], ['Raleigh', 35.7796, -78.6382, 96],
    ['Durham', 35.9940, -78.8986, 120], ['Asheville', 35.5951, -82.5515, 650] ] },
  ND: { name: 'North Dakota', cities: [
    ['Fargo', 46.8750, -96.8100, 274], ['Bismarck', 46.8083, -100.7837, 514] ] },
  OH: { name: 'Ohio', cities: [
    ['Columbus (Short North)', 39.9800, -83.0040, 240], ['Cleveland', 41.4950, -81.6800, 200],
    ['Cincinnati', 39.1150, -84.5150, 150], ['Dayton', 39.7589, -84.1916, 225] ] },
  OK: { name: 'Oklahoma', cities: [
    ['Oklahoma City', 35.4676, -97.5164, 366], ['Tulsa', 36.1540, -95.9928, 220],
    ['Norman', 35.2226, -97.4395, 357] ] },
  OR: { name: 'Oregon', cities: [
    ['Portland (Pearl District)', 45.5230, -122.6900, 30], ['Eugene', 44.0521, -123.0868, 130],
    ['Salem', 44.9429, -123.0351, 46], ['Bend', 44.0582, -121.3153, 1100] ] },
  PA: { name: 'Pennsylvania', cities: [
    ['Philadelphia (Center City)', 39.9526, -75.1652, 12], ['Pittsburgh (Oakland)', 40.4450, -79.9550, 280],
    ['Allentown', 40.6023, -75.4714, 77], ['State College', 40.7934, -77.8600, 350] ] },
  RI: { name: 'Rhode Island', cities: [
    ['Providence', 41.8170, -71.4300, 20], ['Warwick', 41.7001, -71.4162, 20] ] },
  SC: { name: 'South Carolina', cities: [
    ['Columbia', 34.0007, -81.0348, 90], ['Greenville', 34.8526, -82.3940, 300],
    ['Charleston', 32.7900, -79.9450, 5] ] },
  SD: { name: 'South Dakota', cities: [
    ['Sioux Falls', 43.5446, -96.7311, 450], ['Rapid City', 44.0805, -103.2310, 980] ] },
  TN: { name: 'Tennessee', cities: [
    ['Nashville (Midtown)', 36.1500, -86.7950, 170], ['Memphis', 35.1400, -90.0300, 80],
    ['Knoxville', 35.9700, -83.9250, 270], ['Chattanooga', 35.0400, -85.3050, 205] ] },
  TX: { name: 'Texas', cities: [
    ['Houston (Montrose)', 29.7470, -95.3900, 15], ['Dallas', 32.7767, -96.7970, 140],
    ['Austin', 30.2800, -97.7400, 150], ['San Antonio', 29.4241, -98.4936, 200],
    ['Fort Worth', 32.7555, -97.3308, 200], ['Plano', 33.0198, -96.6989, 200],
    ['El Paso', 31.7619, -106.4850, 1140] ] },
  UT: { name: 'Utah', cities: [
    ['Salt Lake City', 40.7608, -111.8910, 1288], ['Provo', 40.2338, -111.6585, 1387],
    ['Park City', 40.6461, -111.4980, 2130], ['St. George', 37.0965, -113.5684, 860] ] },
  VT: { name: 'Vermont', cities: [
    ['Burlington', 44.4780, -73.2000, 61], ['Montpelier', 44.2601, -72.5754, 160] ] },
  VA: { name: 'Virginia', cities: [
    ['Richmond (The Fan)', 37.5500, -77.4500, 50], ['Arlington', 38.8816, -77.0910, 60],
    ['Virginia Beach (Town Center)', 36.8430, -76.1360, 5], ['Charlottesville', 38.0293, -78.4767, 150] ] },
  WA: { name: 'Washington', cities: [
    ['Seattle (Capitol Hill)', 47.6253, -122.3222, 100], ['Bellevue', 47.6101, -122.2015, 50],
    ['Tacoma', 47.2450, -122.4600, 80], ['Spokane', 47.6500, -117.4250, 580] ] },
  WV: { name: 'West Virginia', cities: [
    ['Morgantown', 39.6295, -79.9559, 300], ['Charleston', 38.3550, -81.6350, 185] ] },
  WI: { name: 'Wisconsin', cities: [
    ['Milwaukee', 43.0450, -87.9200, 190], ['Madison', 43.0640, -89.4400, 270],
    ['Green Bay', 44.5050, -88.0000, 180] ] },
  WY: { name: 'Wyoming', cities: [
    ['Cheyenne', 41.1400, -104.8202, 1848], ['Casper', 42.8501, -106.3252, 1560],
    ['Jackson', 43.4799, -110.7624, 1901] ] },
};
