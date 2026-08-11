# OOB: buffer overread past the claimed length into adjacent capacity.
# Analogous to List.unsafe_get / reading past a packet's declared size.
# Run: node run.js --feature risk web/risk/oob.mojo

struct Buf:
    var storage: List[Int]
    var length: Int

    def __init__(out self, storage: List[Int], length: Int):
        self.storage = storage
        self.length = length

    def get(self, i: Int) raises -> Int:
        if i < 0 or i >= self.length:
            raise Error("index out of bounds")
        return self.storage[i]

    # Unchecked load — introduces OOB; callers must acknowledge risk(OOB).
    def get_unchecked(self, i: Int) risk(OOB) -> Int:
        return self.storage[i]

def make_buf(live: List[Int], capacity: Int) -> Buf:
    var storage = List[Int]()
    var i = 0
    while i < len(live):
        storage.append(live[i])
        i += 1
    while i < capacity:
        storage.append(57005)
        i += 1
    return Buf(storage, len(live))

def main():
    var buf = make_buf([10, 20, 30], 8)
    print("live length:", buf.length, "capacity:", len(buf.storage))
    print("checked get(1):", buf.get(1))

    var i = 2
    if i >= 0 and i < buf.length:
        risk(OOB):
            print("proven in-bounds unchecked:", buf.get_unchecked(i))

    var over = buf.length + 1
    risk(OOB):
        print("overread past length into capacity:", buf.get_unchecked(over))

    try:
        print(buf.get(over))
    except e:
        print("safe get rejected overread")
