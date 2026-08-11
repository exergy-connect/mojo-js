# Combined OOB|UNINIT: in-place rotate via reverse (proposal motivating example).
# Index arithmetic stands in for Pointer.offset; element swap for take/write_move_from.
# Run: node run.js --feature risk web/risk/rotate.mojo <k>

# reverse(start, end) inclusive. Caller must ensure 0 <= start <= end < len(buf).
# Inside the loop we still acknowledge:
#   OOB  — start/end may leave the proven window if the caller lied
#   UNINIT — take leaves a hole; write assumes the destination hole is vacant

def reverse(mut buf: List[Int], var start: Int, var end: Int):
    while start < end:
        risk(OOB | UNINIT):
            var tmp = buf[start]
            buf[start] = buf[end]
            buf[end] = tmp
            start += 1
            end -= 1

def rotate(mut buf: List[Int], var k: Int):
    var n = len(buf)
    if n == 0:
        return
    k = k % n
    if k == 0:
        return
    reverse(buf, 0, k - 1)
    reverse(buf, k, n - 1)
    reverse(buf, 0, n - 1)

def main():
    var args = argv()
    var k = 2
    if len(args) >= 2:
        k = atol(args[1])
    var buf = [0, 1, 2, 3, 4, 5, 6]
    print("before:", buf[0], buf[1], buf[2], buf[3], buf[4], buf[5], buf[6])
    rotate(buf, k)
    print("after rotate by", k, ":", buf[0], buf[1], buf[2], buf[3], buf[4], buf[5], buf[6])
