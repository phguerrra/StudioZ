package com.studioz.backend.service;

import com.studioz.backend.dto.ContactDTO;
import com.studioz.backend.model.Contact;
import com.studioz.backend.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;

    public Contact create(ContactDTO dto) {

        Contact contact = new Contact();

        contact.setNome(dto.nome);
        contact.setEmail(dto.email);
        contact.setMensagem(dto.mensagem);

        return contactRepository.save(contact);
    }

    public List<Contact> getAllContacts() {
        return contactRepository.findAll();
    }
}