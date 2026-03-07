# From Mojo structs manual: https://docs.modular.com/mojo/manual/structs/
# struct with fields, __init__(out self, ...), instance method, Copyable trait

struct MyPair(Copyable):
    var first: Int
    var second: Int

    fn __init__(out self, first: Int, second: Int):
        self.first = first
        self.second = second

    fn get_sum(self) -> Int:
        return self.first + self.second

def main():
    var mine = MyPair(2, 4)
    print(mine.first)
    print(mine.get_sum())
    var other = mine.copy()
    print(other.first)
    print("OK: struct_mypair")
