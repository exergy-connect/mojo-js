struct S:
    var x: Int

    def __init__(mut self: Self, x: Int):
        self.x = x

def main():
    var s = S(42)
    print(s.x)
    print("OK: member")
