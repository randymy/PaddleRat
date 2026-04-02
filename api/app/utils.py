import re


def normalize_phone(phone: str) -> str:
    """Strip to digits, ensure +1 prefix for US numbers."""
    digits = re.sub(r"[^\d]", "", phone)
    if len(digits) == 10:
        digits = "1" + digits
    return f"+{digits}"
