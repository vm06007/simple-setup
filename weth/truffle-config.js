module.exports = {
    contracts_build_directory: "./build",
    contracts_directory: "./contracts",
    networks: {
        development: {
            host: "127.0.0.1",
            port: 9545,
            gasLimit: 8000000,
            gas: 7000000,
            network_id: 5777
        }
    },
    mocha: {
        useColors: true,
        reporter: "eth-gas-reporter",
        reporterOptions: {
            currency: "USD",
            gasPrice: 5
        }
    },
    compilers: {
        solc: {
            version: "0.4.18",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                },
            }
        }
    }
};
