from datetime import datetime
import os
import base64
from Crypto.Cipher import AES
from dotenv import load_dotenv
from datetime import datetime 

def get_latest_record_count(record_type):
    from app.models import MedicalRecord 
    
    current_year = datetime.now().year
    
    count = MedicalRecord.query.filter(
        MedicalRecord.record_type == record_type,
        MedicalRecord.created_at >= datetime(current_year, 1, 1)
    ).count()
    
    return count

def generate_record_number(record_type, latest_count):
    mapping = {
        "Kehamilan": "RMH",
        "Persalinan": "RMP",
        "Imunisasi": "RMI",
        "Umum": "RMU",
        "Keluarga Berencana": "RMK"
    }
    prefix = mapping.get(record_type, "RMG")
    year = datetime.now().year
    sequence = f"{(latest_count + 1):03d}"
    return f"{prefix}-{year}-{sequence}"

load_dotenv()
secret_key = os.getenv("ENCRYPTION_KEY").encode()

def encrypt_data(plain_text):
    if not plain_text:
        return None
    
    cipher = AES.new(secret_key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(plain_text.encode())
    
    combined = cipher.nonce + tag + ciphertext
    return base64.b64encode(combined).decode('utf-8')

def decrypt_data(encrypted_text):
    if not encrypted_text:
        return None
    
    combined = base64.b64decode(encrypted_text)
    nonce = combined[:16]
    tag = combined[16:32]
    ciphertext = combined[32:]
    
    cipher = AES.new(secret_key, AES.MODE_GCM, nonce=nonce)
    plain_text = cipher.decrypt_and_verify(ciphertext, tag)
    
    return plain_text.decode('utf-8')
    