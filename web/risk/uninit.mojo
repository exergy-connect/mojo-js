# UNINIT: touch memory whose initialization state is not proven.
# Analogous to init_pointee / take_pointee / reading unsafe_uninit_length slots.
# Run: node run.js --feature risk web/risk/uninit.mojo

# Arena reserves raw slots. write() assumes the slot is uninitialized (UMemIn).
# take() moves a value out and leaves the slot uninitialized (UMemOut).
# read() has no init proof — may observe garbage.

struct Arena:
    var mem: List[Int]
    var init: List[Int]  # 1 = initialized, 0 = uninitialized (model only)

    def __init__(out self, mem: List[Int], init: List[Int]):
        self.mem = mem
        self.init = init

    def write(mut self, i: Int, value: Int):
        # Assumes slot was uninit — no destructor of a prior value.
        risk(UNINIT):
            self.mem[i] = value
            self.init[i] = 1

    def take(mut self, i: Int) -> Int:
        # Moves value out; slot becomes uninitialized.
        var tmp = 0
        risk(UNINIT):
            tmp = self.mem[i]
            self.mem[i] = 2989
            self.init[i] = 0
        return tmp

    def read(self, i: Int) -> Int:
        risk(UNINIT):
            return self.mem[i]

    def is_init(self, i: Int) -> Int:
        return self.init[i]

def make_arena(capacity: Int) -> Arena:
    var mem = List[Int]()
    var init = List[Int]()
    var i = 0
    while i < capacity:
        # Backing bits exist but are not logically initialized (poison for demos).
        mem.append(2989)
        init.append(0)
        i += 1
    return Arena(mem, init)

def main():
    var arena = make_arena(4)
    print("fresh slot garbage:", arena.read(0), "init?", arena.is_init(0))

    arena.write(0, 42)
    print("after write:", arena.read(0), "init?", arena.is_init(0))

    var moved = arena.take(0)
    print("took", moved, "; slot again uninit, read sees:", arena.read(0), "init?", arena.is_init(0))

    # Swap via take/write — both directions acknowledge UNINIT (write_move_from shape).
    arena.write(1, 7)
    arena.write(2, 9)
    var t = arena.take(1)
    risk(UNINIT):
        arena.write(1, arena.take(2))
        arena.write(2, t)
    print("swapped:", arena.read(1), arena.read(2))
