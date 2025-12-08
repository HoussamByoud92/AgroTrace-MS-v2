package com.agrotrace.rules;

import lombok.Data;

@Data
public class Fact {
    private double temperature;
    private double soilMoisture;
    private String cropType;
    private String recommendation;
}
