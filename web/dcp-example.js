async function main() {
    const compute = require('dcp/compute');

    const inputSet = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    async function workFunction(input, arg1, arg2) {
        progress();
        return input * arg1 * arg2;
    };

    let job = compute.for(inputSet, workFunction, [25, 11]);

    job.on('accepted', () => console.log(`Job id: ${job.id}\nAwaiting results...`));
    job.on('error', (error) => console.error('  Job error:', error));

    let results = await job.exec();

    console.log(results);
};

require('dcp-client').init().then(main);