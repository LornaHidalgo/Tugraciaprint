import React, { useState, useContext } from "react";
import { Form, Button } from "react-bootstrap";
import { getFirestore } from "../../../firebase/index";
import firebase from "firebase/compat/app";
import { CartContext } from "../../../context/cartContext";
import { useHistory } from "react-router-dom";

// Define la URL base de tu API.
// En desarrollo, usará 'http://localhost:4000'.
// En producción (Vercel), usará el valor de la variable de entorno REACT_APP_API_URL.
// Asegúrate de configurar REACT_APP_API_URL en Vercel con la URL de tu backend desplegado.
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

export const OrderContent = () => {
  // Eliminamos orderConfirmed ya que la redirección será directa
  // const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState(""); // Aún necesitamos esto para generar el link

  const { cart, getTotal, clearCart } = useContext(CartContext);
  const [buyer, setBuyer] = useState({
    name: "",
    surname: "",
    phone: "",
    email: "",
    confirmEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const history = useHistory();

  const handleInputChange = (e) => {
    setBuyer({
      ...buyer,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (
      !buyer.name ||
      !buyer.surname ||
      !buyer.phone ||
      !buyer.email ||
      !buyer.confirmEmail
    ) {
      setError("Todos los campos son obligatorios.");
      return false;
    }
    if (buyer.email !== buyer.confirmEmail) {
      setError("Los correos electrónicos no coinciden.");
      return false;
    }
    setError("");
    return true;
  };

  const handleFinishOrder = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (cart.length === 0) {
      setError("Tu carrito está vacío. Agrega productos antes de finalizar la compra.");
      return;
    }

    setLoading(true);
    setError("");

    const db = getFirestore();
    const ordersCollection = db.collection("orders");

    // Genera un ID de documento único para la nueva orden
    const newOrderId = ordersCollection.doc().id;

    const newOrder = {
      buyer,
      items: cart.map((cartItem) => ({
        id: cartItem.item.id,
        title: cartItem.item.title,
        price: cartItem.item.price,
        quantity: cartItem.counter,
      })),
      total: getTotal(),
      date: firebase.firestore.Timestamp.fromDate(new Date()),
      status: "Pendiente de contacto",
      orderId: newOrderId, // Asegúrate de guardar el orderId en el documento
    };

    try {
      // Guarda la orden en Firestore
      await ordersCollection.doc(newOrderId).set(newOrder);

      // Realiza la solicitud al backend usando la URL dinámica
      const response = await fetch(`${API_BASE_URL}/send-order-details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: newOrder,
        }),
      });

      // Verifica si la respuesta del servidor fue exitosa (status 2xx)
      if (!response.ok) {
        const errorText = await response.text(); // Intenta leer el cuerpo del error si no es JSON
        throw new Error(`Error al enviar detalles al servidor: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Respuesta del backend:", data.message);

      const phoneNumber = "56928481332"; // Número de teléfono para WhatsApp
      const orderSummary = newOrder.items.map(item => `${item.title} (x${item.quantity})`).join(', ');
      const whatsappMessage = encodeURIComponent(
        `Hola, soy ${buyer.name} ${buyer.surname}. Acabo de realizar la orden Nro. ${newOrder.orderId} por un total de $${newOrder.total}. Detalles: ${orderSummary}. Por favor, contáctame para coordinar la entrega.`
      );

      const generatedWhatsappURL = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;

      // Abre WhatsApp directamente
      window.open(generatedWhatsappURL, "_blank");

      // Limpia el carrito
      clearCart();

      // Redirige a una página de confirmación o a la página de inicio
      history.push("/"); // Puedes cambiar esto a "/order-success" o similar si tienes una página dedicada

    } catch (error) {
      console.error("Error al finalizar la orden:", error);
      // Muestra un mensaje de error más detallado al usuario
      setError(`Error al procesar tu orden: ${error.message}. Por favor, intenta de nuevo.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-content-container">
      <h2>Datos del Cliente</h2>
      <Form onSubmit={handleFinishOrder}>
        <Form.Group className="mb-3">
          <Form.Label className="form-label">Nombre</Form.Label>
          <Form.Control
            className="form-input"
            type="text"
            name="name"
            value={buyer.name}
            onChange={handleInputChange}
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="form-label">Apellido</Form.Label>
          <Form.Control
            className="form-input"
            type="text"
            name="surname"
            value={buyer.surname}
            onChange={handleInputChange}
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="form-label">Teléfono</Form.Label>
          <Form.Control
            className="form-input"
            type="tel"
            name="phone"
            value={buyer.phone}
            onChange={handleInputChange}
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="form-label">Email</Form.Label>
          <Form.Control
            className="form-input"
            type="email"
            name="email"
            value={buyer.email}
            onChange={handleInputChange}
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="form-label">Confirmar Email</Form.Label>
          <Form.Control
            className="form-input"
            type="email"
            name="confirmEmail"
            value={buyer.confirmEmail}
            onChange={handleInputChange}
            required
          />
        </Form.Group>

        {error && <p className="form-error">{error}</p>}

        {cart.length > 0 && (
          <div className="cart-summary">
            <h3>Resumen de la Orden</h3>
            {cart.map((cartItem) => (
              <p key={cartItem.item.id}>
                {cartItem.item.title} (x{cartItem.counter}) - $
                {cartItem.item.price * cartItem.counter}
              </p>
            ))}
            <h4>Total: ${getTotal()}</h4>
          </div>
        )}

        {/* El botón de confirmar orden ahora maneja todo el flujo */}
        <Button
          variant="primary"
          type="submit"
          disabled={loading || cart.length === 0}
          className="mt-3"
        >
          {loading ? "Enviando..." : "Confirmar Orden y Chatear por WhatsApp"}
        </Button>

        {/* Eliminamos el bloque de orderConfirmed y el botón secundario de WhatsApp */}
      </Form>
    </div>
  );
};
