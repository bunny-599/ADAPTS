package com.adapts.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class QuestionItem {

    @Column(name = "question", columnDefinition = "TEXT", nullable = false)
    private String question;

    @Column(name = "type", nullable = false)
    private String type; // "theory" or "coding"

    // Default constructor for JPA
    public QuestionItem() {}

    public QuestionItem(String question, String type) {
        this.question = question;
        this.type = type;
    }

    // Getters and Setters
    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
