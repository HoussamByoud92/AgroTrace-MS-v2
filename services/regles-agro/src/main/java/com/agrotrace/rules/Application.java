package com.agrotrace.rules;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @org.springframework.context.annotation.Bean
    public org.kie.api.runtime.KieContainer kieContainer() {
        return org.kie.api.KieServices.Factory.get().getKieClasspathContainer();
    }
}
