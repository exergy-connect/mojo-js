# Minimal Mojo program for the JS interpreter
def main():
    var args = argv()
    if len(args) < 2:
        print("Usage: node run.js example.mojo <N>")
        return
    var n = atol(args[1])
    print("N =", n)
    var r = range(5)
    print("range(5) length:", len(r))
