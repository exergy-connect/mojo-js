def main():
    if True:
        print("outer-then")
        if False:
            print("inner-then")
        else:
            print("inner-else")
        print("after-inner")
    else:
        print("outer-else")
    print("after-outer")
    print("OK: if_else_nested")
