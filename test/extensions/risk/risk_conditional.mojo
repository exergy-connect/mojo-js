# Comptime Bool chooses whether OOB is introduced via get_unchecked.

def get_unchecked(i: Int) risk(OOB) -> Int:
    return i

def access[BOUNDS_CHECK: Bool](i: Int) -> Int:
    if BOUNDS_CHECK:
        if i < 0 or i >= 3:
            raise Error("oob")
        return i
    risk(OOB):
        return get_unchecked(i)

def main():
    print(access[True](1))
    print(access[False](2))
    print("OK: risk_conditional")
