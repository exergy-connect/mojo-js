struct S:
    var x: Int

    def __init__(mut self: Self, x: Int):
        self.x = x

    def get(mut self: Self) -> Int:
        return self.x

def main():
    var s = S(5)
    print(s.get())
    print("OK: struct_method")
