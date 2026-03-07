# Exceptions demo: calculate_average raises on empty data, main uses try-except.

fn calculate_average(temps: List[Float64]) raises -> Float64:
    if len(temps) == 0:
        raise Error("No temperature data")

    var total: Float64 = 0.0
    for index in range(len(temps)):
        total += temps[index]
    return total / len(temps)

def main():
    var temps = [20.0, 22.0, 24.0, 21.0, 23.0]
    try:
        var avg = calculate_average(temps)
        print("Average:", avg, "°C")
        if avg > 25.0:
            print("Status: Hot week")
        elif avg > 20.0:
            print("Status: Comfortable week")
        else:
            print("Status: Cool week")
        print("OK: exceptions_demo")
    except e:
        print("Error:", e)
