package com.studioz.backend.controller;

import com.studioz.backend.dto.ContactDTO;
import com.studioz.backend.model.Contact;
import com.studioz.backend.service.ContactService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/contact")
@RequiredArgsConstructor
@CrossOrigin("*")
public class ContactController {

    private final ContactService contactService;

    @PostMapping
    public Map<String, Object> createContact(
            @RequestBody ContactDTO dto
    ) {

        Contact contact = contactService.create(dto);

        Map<String, Object> response =
                new HashMap<>();

        response.put("ok", true);
        response.put("message", "Mensagem enviada com sucesso");
        response.put("contact", contact);

        return response;
    }
}