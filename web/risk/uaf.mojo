# UAF: use a slot after it was freed and possibly reused by a later allocation.
# Run: node run.js --feature risk web/risk/uaf.mojo

struct Heap:
    var slots: List[Int]
    var live: List[Int]  # 1 = allocated, 0 = free

    def __init__(out self, slots: List[Int], live: List[Int]):
        self.slots = slots
        self.live = live

    def alloc(mut self, value: Int) raises -> Int:
        var i = 0
        while i < len(self.slots):
            if self.live[i] == 0:
                self.live[i] = 1
                self.slots[i] = value
                return i
            i += 1
        raise Error("out of memory")

    def free(mut self, handle: Int):
        self.live[handle] = 0

    def load(self, handle: Int) raises -> Int:
        if handle < 0 or handle >= len(self.slots) or self.live[handle] == 0:
            raise Error("invalid handle")
        return self.slots[handle]

    # Raw load with no liveness proof — introduces UAF.
    def load_raw(self, handle: Int) risk(UAF) -> Int:
        return self.slots[handle]

def make_heap(capacity: Int) -> Heap:
    var slots = List[Int]()
    var live = List[Int]()
    var i = 0
    while i < capacity:
        slots.append(0)
        live.append(0)
        i += 1
    return Heap(slots, live)

def main():
    var heap = make_heap(4)
    var a = heap.alloc(111)
    print("alloc a ->", a, "value", heap.load(a))

    var dangling = a
    heap.free(a)
    try:
        print(heap.load(dangling))
    except e:
        print("safe load rejected dangling handle")

    var b = heap.alloc(222)
    print("alloc b ->", b, "(reused same slot:", b == dangling, ")")
    risk(UAF):
        print("dangling load_raw sees:", heap.load_raw(dangling), "(b's value, via stale handle)")
