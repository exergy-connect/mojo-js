# access[True] → NO_RISK; access[False] → OOB (needs acknowledgment at the call site).

def access[BOUNDS_CHECK: Bool](i: Int) risk(OOB if not BOUNDS_CHECK else NO_RISK) -> Int:
    if BOUNDS_CHECK:
        if i < 0 or i >= 3:
            raise Error("oob")
        return i
    return i

def main():
    print(access[True](1))
    risk(OOB):
        print(access[False](2))
    print("OK: risk_conditional")
