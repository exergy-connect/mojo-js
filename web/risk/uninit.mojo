# UNINIT: touch memory whose initialization state is not proven.
# Analogous to init_pointee / take_pointee / reading unsafe_uninit_length slots.
# Run: node run.js --feature risk web/risk/uninit.mojo
#
# Methods that introduce UNINIT are annotated risk(UNINIT). Call sites must
# acknowledge that risk with risk(UNINIT): (or def ... risk(UNINIT):), unless
# you pass --accept-risks.

struct Arena:
    var mem: List[Int]
    var init: List[Int]  # 1 = initialized, 0 = uninitialized (model only)

    def __init__(out self, mem: List[Int], init: List[Int]):
        self.mem = mem
        self.init = init

    # UMemIn: write assumes the slot is uninitialized (no prior destructor).
    def write(mut self, i: Int, value: Int) risk(UNINIT):
        self.mem[i] = value
        self.init[i] = 1

    # UMemOut: take moves a value out and leaves the slot uninitialized.
    def take(mut self, i: Int) risk(UNINIT) -> Int:
        var tmp = self.mem[i]
        self.mem[i] = 2989
        self.init[i] = 0
        return tmp

    def read(self, i: Int) risk(UNINIT) -> Int:
        return self.mem[i]

    def is_init(self, i: Int) -> Int:
        return self.init[i]

def make_arena(capacity: Int) -> Arena:
    var mem = List[Int]()
    var init = List[Int]()
    var i = 0
    while i < capacity:
        mem.append(2989)
        init.append(0)
        i += 1
    return Arena(mem, init)

def main():
    var arena = make_arena(4)

    risk(UNINIT):
        print("fresh slot garbage:", arena.read(0), "init?", arena.is_init(0))
        arena.write(0, 42)
        print("after write:", arena.read(0), "init?", arena.is_init(0))
        var moved = arena.take(0)
        print("took", moved, "; slot again uninit, read sees:", arena.read(0), "init?", arena.is_init(0))
        arena.write(1, 7)
        arena.write(2, 9)
        var t = arena.take(1)
        arena.write(1, arena.take(2))
        arena.write(2, t)
        print("swapped:", arena.read(1), arena.read(2))
