# Conditional risk: comptime BOUNDS_CHECK chooses OOB acknowledgment vs NO_RISK.
# get_unchecked introduces OOB; the checked path never calls it.
# Run: node run.js --feature risk web/risk/conditional.mojo

def get_unchecked(arr: List[Int], i: Int) risk(OOB) -> Int:
    return arr[i]

def get[BOUNDS_CHECK: Bool](arr: List[Int], i: Int) raises -> Int:
    if BOUNDS_CHECK:
        if i < 0 or i >= len(arr):
            raise Error("index out of bounds")
        return arr[i]
    risk(OOB):
        return get_unchecked(arr, i)

def sum_prefix[BOUNDS_CHECK: Bool](arr: List[Int], n: Int) raises -> Int:
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

    print("unchecked overread sum (n=5):", sum_prefix[False](arr, 5))
