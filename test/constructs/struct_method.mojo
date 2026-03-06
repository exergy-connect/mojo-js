struct S:
    var x: Int

    fn __init__(inout self: Self, x: Int):
        self.x = x

    fn get(inout self: Self) -> Int:
        return self.x

def main():
    var s = S(5)
    print(s.get())
    print("OK: struct_method")
