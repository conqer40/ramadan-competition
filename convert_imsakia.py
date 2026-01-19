import openpyxl
import json
import re

def parse_time(t_str):
    # Normalize time string to valid format if needed
    # The excel output showed times like '05:15 ص'
    return t_str

try:
    wb = openpyxl.load_workbook(r'd:\رمضانك عندنا\امساكيه رمضان 2026.xlsx')
    sheet = wb.active
    
    days = []
    # Skip header (row 1)
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not row[0]: continue # Empty row
        
        # Row structure based on previous print:
        # 0: Day Name (الأربعاء)
        # 1: Ramadan Day (1)
        # 2: Gregorian Date (18 فبراير، 2026)
        # 3: Fajr
        # 4: Sunrise
        # 5: Dhuhr
        # 6: Asr
        # 7: Maghrib
        # 8: Isha
        
        day_data = {
            "day_name": row[0],
            "ramadan_date": row[1],
            "gregorian_date": row[2],
            "fajr": row[3],
            "sunrise": row[4],
            "dhuhr": row[5],
            "asr": row[6],
            "maghrib": row[7],
            "isha": row[8]
        }
        days.append(day_data)

    with open(r'd:\رمضانك عندنا\data\imsakia.json', 'w', encoding='utf-8') as f:
        json.dump(days, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully created imsakia.json with {len(days)} days.")

except Exception as e:
    print(f"Error: {e}")
