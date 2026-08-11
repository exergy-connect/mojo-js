# From Mojo traits manual: https://docs.modular.com/mojo/manual/traits
# Trait with required method, struct conforming to trait

trait Quackable:
    def quack(self):
        pass

struct Duck(Copyable, Quackable):
    def __init__(out self):
        pass

    def quack(self):
        print("Quack")

def main():
    var d = Duck()
    requireTrait(d, ["quack"])
    d.quack()
    print("OK: trait_quackable")
