"""
Standalone Mojo implementation of the basic IVI factorization algorithm.
No Python dependency. Run with: mojo run ivi_standalone.mojo <N>
Example: mojo run ivi_standalone.mojo 3127
"""

from std.sys import argv
from std.collections import List

# ---------------------------------------------------------------------------
# Branch state: one node in the frontier (Copyable so List[Branch] works)
# ---------------------------------------------------------------------------
struct Branch(Copyable):
    var k: Int
    var p_history: List[Int]
    var q_history: List[Int]
    var p_value: Int
    var q_value: Int
    var carry_in: Int

    fn __init__(out self, k: Int, p_history: List[Int], q_history: List[Int], p_value: Int, q_value: Int, carry_in: Int):
        self.k = k
        self.p_history = p_history.copy()
        self.q_history = q_history.copy()
        self.p_value = p_value
        self.q_value = q_value
        self.carry_in = carry_in

    fn __copyinit__(out self, copy: Self):
        self.k = copy.k
        self.p_history = copy.p_history.copy()
        self.q_history = copy.q_history.copy()
        self.p_value = copy.p_value
        self.q_value = copy.q_value
        self.carry_in = copy.carry_in

# ---------------------------------------------------------------------------
# One valid digit-pair result: (pk, qk, carry_out)
# ---------------------------------------------------------------------------
struct Candidate(Copyable):
    var pk: Int
    var qk: Int
    var carry_out: Int

    fn __init__(out self, pk: Int, qk: Int, carry_out: Int):
        self.pk = pk
        self.qk = qk
        self.carry_out = carry_out

# ---------------------------------------------------------------------------
# Algorithm state: N, digits, frontier, step count
# ---------------------------------------------------------------------------
struct AlgorithmState(Movable):
    var n: Int
    var n_digits: List[Int]
    var step: Int
    var frontier: List[Branch]
    var done: Bool
    var success: Bool
    var found_p: Int
    var found_q: Int

    fn __init__(out self, *, deinit take: Self):
        self.n = take.n
        self.n_digits = take.n_digits^
        self.step = take.step
        self.frontier = take.frontier^
        self.done = take.done
        self.success = take.success
        self.found_p = take.found_p
        self.found_q = take.found_q

    fn __copyinit__(out self, copy: Self):
        self.n = copy.n
        self.n_digits = copy.n_digits.copy()
        self.step = copy.step
        self.frontier = copy.frontier.copy()
        self.done = copy.done
        self.success = copy.success
        self.found_p = copy.found_p
        self.found_q = copy.found_q

    fn __init__(out self, n: Int):
        self.n = n
        self.n_digits = digits_lsd_first(n)
        self.step = 0
        self.frontier = List[Branch]()
        var seed = Branch(1, List[Int](), List[Int](), 0, 0, 0)
        self.frontier.append(seed^)
        self.done = False
        self.success = False
        self.found_p = 0
        self.found_q = 0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
fn multiply_digits(a: Int, b: Int) -> Int:
    return a * b

fn digits_lsd_first(n: Int) -> List[Int]:
    """Return digits of n from least significant to most (LSD first)."""
    var out = List[Int]()
    var x = n
    if x == 0:
        out.append(0)
        return out^
    while x > 0:
        out.append(x % 10)
        x = x // 10
    return out^

fn power10(exp: Int) -> Int:
    var r: Int = 1
    for _ in range(exp):
        r = r * 10
    return r

# ---------------------------------------------------------------------------
# IVI work function: from one branch at position k, return valid (pk, qk, carry_out)
# ---------------------------------------------------------------------------
fn ivi_candidates(
    k: Int,
    p_history: List[Int],
    q_history: List[Int],
    carry_in: Int,
    target_digit: Int,
    is_last_digit: Bool,
) -> List[Candidate]:
    var base_sum: Int = 0
    var len_ph = len(p_history)
    var len_qh = len(q_history)
    if k > 1:
        for i in range(2, k):
            var p_idx = i - 1
            var q_idx = k - i
            if p_idx < len_ph and q_idx >= 0 and q_idx < len_qh:
                base_sum += multiply_digits(p_history[p_idx], q_history[q_idx])
    var q1: Int = 0
    var p1: Int = 0
    if len_qh > 0:
        q1 = q_history[0]
    if len_ph > 0:
        p1 = p_history[0]

    var result = List[Candidate]()
    for pk in range(10):
        for qk in range(10):
            var sum_of_products: Int
            if k == 1:
                sum_of_products = multiply_digits(pk, qk)
            else:
                sum_of_products = base_sum + multiply_digits(p1, qk) + multiply_digits(pk, q1)
            var total = sum_of_products + carry_in
            if total < target_digit:
                continue
            var remainder = total - target_digit
            if remainder % 10 != 0:
                continue
            var carry_out = remainder // 10
            if carry_out < 0 or carry_out > 10:
                continue
            if is_last_digit and carry_out != 0:
                continue
            result.append(Candidate(pk, qk, carry_out))
    return result^

# ---------------------------------------------------------------------------
# Expand one branch into next branches at current_k
# ---------------------------------------------------------------------------
fn expand_branch(
    branch: Branch,
    current_k: Int,
    n_digits: List[Int],
) -> List[Branch]:
    var target_digit = n_digits[current_k - 1]
    var is_last = current_k == len(n_digits)
    var candidates = ivi_candidates(
        current_k,
        branch.p_history,
        branch.q_history,
        branch.carry_in,
        target_digit,
        is_last,
    )
    var next_list = List[Branch]()
    var pow_k = power10(current_k - 1)
    for c in candidates:
        var new_ph = List[Int](branch.p_history)
        new_ph.append(c.pk)
        var new_qh = List[Int](branch.q_history)
        new_qh.append(c.qk)
        var new_p = branch.p_value + c.pk * pow_k
        var new_q = branch.q_value + c.qk * pow_k
        next_list.append(Branch(current_k + 1, new_ph, new_qh, new_p, new_q, c.carry_out))
    return next_list^

# ---------------------------------------------------------------------------
# One step of the algorithm (mutates state in place)
# ---------------------------------------------------------------------------
fn step(mut state: AlgorithmState) -> None:
    if state.done:
        return
    var current_k = state.step + 1
    if current_k > len(state.n_digits):
        return
    var all_results = List[Branch]()
    for branch in state.frontier:
        var next_branches = expand_branch(branch, current_k, state.n_digits)
        for b in next_branches:
            all_results.append(b.copy())
    if len(all_results) == 0:
        state.done = True
        return
    if current_k == len(state.n_digits):
        for branch in all_results:
            if branch.carry_in == 0 and branch.p_value * branch.q_value == state.n:
                var p = branch.p_value
                var q = branch.q_value
                if p > 1 and q > 1:
                    if p > q:
                        var t = p
                        p = q
                        q = t
                    state.step = current_k
                    state.frontier = all_results.copy()
                    state.done = True
                    state.success = True
                    state.found_p = p
                    state.found_q = q
                    return
        state.step = current_k
        state.frontier = all_results.copy()
        state.done = True
        return
    state.step = current_k
    state.frontier = all_results.copy()

# ---------------------------------------------------------------------------
# Run until done
# ---------------------------------------------------------------------------
fn factorize(n: Int) -> AlgorithmState:
    """Run until done; state.success and state.found_p/found_q hold result."""
    var state = AlgorithmState(n)
    while not state.done:
        step(state)
    return state^

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    var args = argv()
    if len(args) < 2:
        print("Usage: mojo run ivi_standalone.mojo <N>")
        print("Example: mojo run ivi_standalone.mojo 3127")
        return
    var n_str = args[1]
    var n = atol(n_str)
    if n < 4:
        print("N must be at least 4")
        return
    print("Factoring N =", n, "...")
    var state = factorize(n)
    if state.success:
        print("p =", state.found_p)
        print("q =", state.found_q)
        print("p * q =", state.found_p * state.found_q)
    else:
        print("No factorization found.")
