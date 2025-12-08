package com.agrotrace.rules;

import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rules")
public class RuleController {

    @Autowired
    private KieContainer kieContainer;

    @PostMapping("/evaluate")
    public Fact evaluate(@RequestBody Fact fact) {
        KieSession kieSession = kieContainer.newKieSession();
        kieSession.insert(fact);
        kieSession.fireAllRules();
        kieSession.dispose();
        return fact;
    }
}
