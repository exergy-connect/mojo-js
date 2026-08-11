# UAF: use a slot after it was freed and possibly reused by a later allocation.
# Analogous to holding unsafe_ptr() / a dangling origin across free + alloc.
# Run: node run.js --feature risk web/risk/uaf.mojo

# Tiny bump heap. free() marks a slot dead but does not wipe it; alloc() may reuse
# the same index. A stale handle that loads after free is use-after-free.

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
        # Intentionally do not clear slots[handle] — mirrors real free.

    # "Safe" load: refuses dead handles.
    def load(self, handle: Int) raises -> Int:
        if handle < 0 or handle >= len(self.slots) or self.live[handle] == 0:
            raise Error("invalid handle")
        return self.slots[handle]

    # Raw load with no liveness proof — UAF if the handle was freed (and maybe reused).
    def load_raw(self, handle: Int) -> Int:
        risk(UAF):
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

    # Stash a dangling handle, then free.
    var dangling = a
    heap.free(a)
    try:
        print(heap.load(dangling))
    except e:
        print("safe load rejected dangling handle")

    # Reuse the same slot; the stale handle still indexes it (UAF / type-confusion shape).
    var b = heap.alloc(222)
    print("alloc b ->", b, "(reused same slot:", b == dangling, ")")
    print("dangling load_raw sees:", heap.load_raw(dangling), "(b's value, via stale handle)")
