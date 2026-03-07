# From Mojo traits manual: https://docs.modular.com/mojo/manual/traits
# Trait with required method, struct conforming to trait

trait Quackable:
    fn quack(self):
        pass

struct Duck(Copyable, Quackable):
    fn __init__(out self):
        pass

    fn quack(self):
        print("Quack")

def main():
    var d = Duck()
    requireTrait(d, ["quack"])
    d.quack()
    print("OK: trait_quackable")
