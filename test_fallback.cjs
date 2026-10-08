
const CODE_DEFAULT_CATEGORY_SETTINGS = {
    best_bet: {
        name: "Best Bets Default",
        description: "Default desc",
        baseWeightIntervals: [1, 2, 3],
        rules: [1, 2]
    }
};

const OPTIMIZED_CATEGORY_SETTINGS = JSON.parse(JSON.stringify(CODE_DEFAULT_CATEGORY_SETTINGS));

function replaceAllOptimizedCategorySettings(settings) {
    const HARDCODED_CATEGORIES = ["best_bet"];
    const merged = { ...OPTIMIZED_CATEGORY_SETTINGS };
    
    for (const key of Object.keys(settings)) {
        if (HARDCODED_CATEGORIES.includes(key)) {
            const codeDefault = CODE_DEFAULT_CATEGORY_SETTINGS[key];
            if (codeDefault) {
                merged[key] = {
                    ...codeDefault,
                    name: settings[key].name || codeDefault.name,
                    description: settings[key].description || codeDefault.description,
                    baseWeightIntervals: (settings[key].baseWeightIntervals && settings[key].baseWeightIntervals.length > 0)
                        ? settings[key].baseWeightIntervals
                        : [...codeDefault.baseWeightIntervals],
                    rules: [...(codeDefault.rules || [])]
                };
            }
        }
    }
    Object.assign(OPTIMIZED_CATEGORY_SETTINGS, merged);
}

const savedSettings = {
    best_bet: {
        name: "Best Bets Saved",
        description: "Saved desc",
        baseWeightIntervals: []
    }
};

replaceAllOptimizedCategorySettings(savedSettings);

console.log(OPTIMIZED_CATEGORY_SETTINGS.best_bet.baseWeightIntervals);

