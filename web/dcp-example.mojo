# DCP compute example - Mojo version of dcp-example.js
# Assumes a 'dcp' module providing compute, progress, and job lifecycle.
# (JS API uses compute.for(); here we use compute.run to avoid keyword.)

from dcp import compute

fn work_function(input: Int, arg1: Int, arg2: Int) -> Int:
    progress()
    return input * arg1 * arg2

def main():
    var input_set = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    var job = compute.run(input_set, work_function, [25, 11])

    job.on("accepted", accepted_callback)
    job.on("error", error_callback)

    var results = job.exec()
    print(results)

fn accepted_callback():
    print("Job accepted. Awaiting results...")

fn error_callback(err):
    print("Job error:", err)
