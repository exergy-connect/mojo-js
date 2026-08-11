# Conditional risk: comptime BOUNDS_CHECK chooses OOB acknowledgment vs NO_RISK.
# Same unchecked load as List.unsafe_get; the if-arm is the mitigation proof.
# Run: node run.js --feature risk web/risk/conditional.mojo

def get[BOUNDS_CHECK: Bool](arr: List[Int], i: Int) raises -> Int:
    if BOUNDS_CHECK:
        if i < 0 or i >= len(arr):
            raise Error("index out of bounds")
    risk(OOB if not BOUNDS_CHECK else NO_RISK):
        return arr[i]

def sum_prefix[BOUNDS_CHECK: Bool](arr: List[Int], n: Int) raises -> Int:
    # Sum first n elements. With checks off, n > len(arr) is a real overread.
    var total = 0
    var i = 0
    while i < n:
        total += get[BOUNDS_CHECK](arr, i)
        i += 1
    return total

def main():
    var arr = [10, 20, 30]
    print("checked in-bounds:", get[True](arr, 1))
    print("unchecked in-bounds:", get[False](arr, 2))
    print("checked prefix sum:", sum_prefix[True](arr, 3))

    try:
        print(get[True](arr, 99))
    except e:
        print("checked path rejected OOB index")

    # Unchecked path: n past len — JS returns undefined; in native Mojo this is UB.
    print("unchecked overread sum (n=5):", sum_prefix[False](arr, 5))
