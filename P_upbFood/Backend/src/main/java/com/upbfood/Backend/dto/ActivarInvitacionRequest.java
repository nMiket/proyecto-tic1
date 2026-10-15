
package com.upbfood.Backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ActivarInvitacionRequest {

    @NotBlank
    @Size(min = 8, max = 72)
    private String password;

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
