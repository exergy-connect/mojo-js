# "Iterating using references" from
# https://docs.modular.com/mojo/manual/control-flow#iterating-using-references

def main():
    var values = [1, 4, 7, 3, 6, 11]
    for ref value in values:
        if value % 2 != 0:
            value -= 1
    print(values)
    print("OK: for_ref_iter")
