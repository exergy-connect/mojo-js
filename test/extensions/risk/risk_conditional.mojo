# Comptime Bool chooses whether OOB is acknowledged or mitigated to NO_RISK.

def access[BOUNDS_CHECK: Bool](i: Int) -> Int:
    if BOUNDS_CHECK:
        if i < 0 or i >= 3:
            raise Error("oob")
    risk(OOB if not BOUNDS_CHECK else NO_RISK):
        return i

def main():
    print(access[True](1))
    print(access[False](2))
    print("OK: risk_conditional")
