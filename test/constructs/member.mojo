struct S:
    var x: Int

    fn __init__(inout self: Self, x: Int):
        self.x = x

def main():
    var s = S(42)
    print(s.x)
    print("OK: member")
