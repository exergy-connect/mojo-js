def main():
    var enc = b64encode("hello")
    var dec = b64decode(enc)
    print(dec)
    print("OK: base64")
