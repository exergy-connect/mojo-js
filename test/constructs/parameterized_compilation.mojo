# Parameterized compilation (compile-time loop), per Modular docs example
# https://docs.modular.com/mojo/tools/notebooks/#example-parameterized-compilation

fn repeat[count: Int](msg: String):
    comptime for i in range(count):
        print(msg)

fn threehello():
    repeat[3]("Hello!")

def main():
    threehello()
    print("OK: parameterized_compilation")
