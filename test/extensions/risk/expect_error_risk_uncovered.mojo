def load() risk(UNINIT) -> Int:
    return 1

def main():
    # Uncovered call — compile error unless --accept-risks
    print(load())
