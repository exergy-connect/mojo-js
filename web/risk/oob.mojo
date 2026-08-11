# OOB: buffer overread past the claimed length into adjacent capacity.
# Analogous to List.unsafe_get / reading past a packet's declared size (Heartbleed-shaped).
# Run: node run.js --feature risk web/risk/oob.mojo

# Physical storage is larger than the live prefix. Slots [length, capacity) are not
# part of the value — but nothing stops an unchecked load from touching them.

struct Buf:
    var storage: List[Int]
    var length: Int

    def __init__(out self, storage: List[Int], length: Int):
        self.storage = storage
        self.length = length

    # Safe: refuses indexes outside the live prefix.
    def get(self, i: Int) raises -> Int:
        if i < 0 or i >= self.length:
            raise Error("index out of bounds")
        return self.storage[i]

    # Unchecked: same load as unsafe_get — caller must have proven i is in range,
    # or is deliberately accepting OOB (e.g. scanning into capacity).
    def get_unchecked(self, i: Int) -> Int:
        risk(OOB):
            return self.storage[i]

def make_buf(live: List[Int], capacity: Int) -> Buf:
    var storage = List[Int]()
    var i = 0
    while i < len(live):
        storage.append(live[i])
        i += 1
    # Pad capacity with a distinct "secret" so an overread is visible.
    while i < capacity:
        storage.append(57005)
        i += 1
    return Buf(storage, len(live))

def main():
    var buf = make_buf([10, 20, 30], 8)
    print("live length:", buf.length, "capacity:", len(buf.storage))
    print("checked get(1):", buf.get(1))

    # Caller already proved i < length — still an OOB acknowledgment at the raw load.
    var i = 2
    if i >= 0 and i < buf.length:
        print("proven in-bounds unchecked:", buf.get_unchecked(i))

    # Classic overread: offset past claimed length into adjacent capacity.
    var over = buf.length + 1
    print("overread past length into capacity:", buf.get_unchecked(over))

    try:
        print(buf.get(over))
    except e:
        print("safe get rejected overread")
